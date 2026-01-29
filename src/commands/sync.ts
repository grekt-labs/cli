import { Command } from "commander";
import { confirm, checkbox } from "@inquirer/prompts";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getLockfile } from "#/context";
import { getPlugin, getAvailableTargets, getPluginChoices } from "#/sync/manager/manager";
import { success, error, info, warning, log, newline, colors, spinner } from "#/shared/ui/ui";
import { withPromptHandler, promptCustomTarget } from "#/shared/prompts/prompts";
import type { CustomTarget } from "@grekt-labs/cli-engine";

const OTHER_TARGET_VALUE = "__other__";

export const syncCommand = new Command("sync")
  .description("Sync artifacts to AI tools")
  .option("--dry-run", "Preview changes without applying them")
  .option("-f, --force", "Skip confirmation prompts")
  .option("-t, --target <targets>", "Comma-separated list of targets")
  .option("-n, --new", "Configure new sync targets interactively")
  .action(async (options: { dryRun?: boolean; force?: boolean; target?: string; new?: boolean }) => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      if (!isInitialized(projectRoot)) {
        error("grekt is not initialized in this directory");
        info("Run 'grekt init' first");
        process.exit(1);
      }

    let config = getConfig(projectRoot);
    const lockfile = getLockfile(projectRoot);

    // Interactive target configuration with --new
    if (options.new) {
      const pluginChoices = getPluginChoices();
      const currentTargets = new Set(config.targets);

      const choices = [
        ...pluginChoices.map((choice) => ({
          ...choice,
          checked: currentTargets.has(choice.value),
        })),
        {
          name: "Other (custom)",
          value: OTHER_TARGET_VALUE,
          checked: false,
        },
      ];

      newline();
      const selected = await checkbox<string>({
        message: "Select AI tools to sync with:",
        choices,
      });

      const customTargets: Record<string, CustomTarget> = { ...config.customTargets };

      // Handle "Other" selection
      if (selected.includes(OTHER_TARGET_VALUE)) {
        const builtInIds = pluginChoices.map((p) => p.value);
        const { id: customId, config: customTarget } = await promptCustomTarget(builtInIds);

        customTargets[customId] = customTarget;

        // Replace __other__ with the custom ID
        const newTargets = selected.filter((t) => t !== OTHER_TARGET_VALUE);
        newTargets.push(customId);
        config.targets = newTargets;
      } else {
        config.targets = selected;
      }

      config.customTargets = customTargets;
      saveConfig(config, projectRoot);

      if (config.targets.length === 0) {
        info("No targets selected");
        return;
      }

      newline();
      success(`Targets updated: ${config.targets.join(", ")}`);
      newline();
    }

    // Determine targets
    let targets: string[] = config.targets;
    if (options.target) {
      targets = options.target.split(",").map((t) => t.trim());
    }

    if (targets.length === 0) {
      warning("No sync targets configured");
      info(`Available targets: ${getAvailableTargets().join(", ")}`);
      info("Run 'grekt sync --new' to configure targets or use --target flag");
      return;
    }

    // Validate targets (built-in + custom)
    const customTargetIds = Object.keys(config.customTargets || {});
    const invalidTargets = targets.filter(
      (t) => !getAvailableTargets().includes(t) && !customTargetIds.includes(t)
    );
    if (invalidTargets.length > 0) {
      error(`Unknown targets: ${invalidTargets.join(", ")}`);
      info(`Available: ${[...getAvailableTargets(), ...customTargetIds].join(", ")}`);
      process.exit(1);
    }

    const hasArtifacts = Object.keys(lockfile.artifacts).length > 0;

    if (!hasArtifacts) {
      info("No artifacts installed yet");
      info("Run 'grekt add <artifact>' to install artifacts first");
      return;
    }

    if (options.dryRun) {
      log(colors.bold("Dry run - no changes will be made\n"));
    }

    for (const target of targets) {
      const plugin = getPlugin(target, config.customTargets);
      log(colors.bold(`\nSyncing ${plugin.name}...`));

      const targetExists = plugin.targetExists(projectRoot);

      // Ask to create target if it doesn't exist
      let createTarget = false;
      if (!targetExists && !options.dryRun) {
        if (options.force) {
          createTarget = true;
        } else {
          createTarget = await confirm({
            message: `${plugin.targetFile} doesn't exist. Create it?`,
            default: true,
          });
        }

        if (!createTarget) {
          info(`Skipping ${plugin.name}`);
          continue;
        }
      }

      // Preview or sync
      if (options.dryRun) {
        const preview = plugin.preview(lockfile, projectRoot, { projectConfig: config });

        if (preview.willCreate.length > 0) {
          log(colors.dim("  Would create:"));
          for (const file of preview.willCreate) {
            log(`    ${colors.success("+")} ${file}`);
          }
        }

        if (preview.willUpdate.length > 0) {
          log(colors.dim("  Would update:"));
          for (const file of preview.willUpdate) {
            log(`    ${colors.info("~")} ${file}`);
          }
        }

        if (preview.willSkip.length > 0) {
          log(colors.dim("  Would skip:"));
          for (const file of preview.willSkip) {
            log(`    ${colors.warning("-")} ${file}`);
          }
        }
      } else {
        const spin = spinner(`Syncing ${plugin.name}...`);
        spin.start();

        const result = await plugin.sync(lockfile, projectRoot, {
          createTarget,
          force: options.force,
          projectConfig: config,
        });

        spin.stop();

        for (const file of result.created) {
          success(`Created ${file}`);
        }

        for (const file of result.updated) {
          info(`Updated ${file}`);
        }

        for (const file of result.skipped) {
          warning(`Skipped ${file}`);
        }
      }
    }

    newline();
    if (options.dryRun) {
      info("Run without --dry-run to apply changes");
    } else {
      success("Sync complete!");
    }
    });
  });
