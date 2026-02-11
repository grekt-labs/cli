import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { getConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile } from "#/context";
import { getPlugin, getAvailableTargets } from "#/sync/manager/manager";
import { runSync } from "#/sync/runner/runner";
import { success, error, info, warning, log, newline, colors } from "#/shared/ui/ui";
import { withPromptHandler } from "#/shared/prompts/prompts";

export const syncCommand = new Command("sync")
  .description("Sync artifacts to AI tools")
  .option("--dry-run", "Preview changes without applying them")
  .option("-f, --force", "Skip confirmation prompts")
  .option("-t, --target <targets>", "Comma-separated list of targets")
  .action(async (options: { dryRun?: boolean; force?: boolean; target?: string }) => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      requireInitialized(projectRoot);

      const config = getConfig(projectRoot);
      const lockfile = getLockfile(projectRoot);

      // Determine targets
      let targets: string[] = config.targets;
      if (options.target) {
        targets = options.target.split(",").map((t) => t.trim());
      }

      if (targets.length === 0) {
        warning("No sync targets configured");
        info(`Available targets: ${getAvailableTargets().join(", ")}`);
        info("Run 'grekt add-target' to configure targets");
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

        for (const target of targets) {
          const plugin = getPlugin(target, config.customTargets);
          log(colors.bold(`\nSyncing ${plugin.name}...`));

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
        }

        newline();
        info("Run without --dry-run to apply changes");
        return;
      }

      // Non-dry-run: resolve createTarget per plugin (interactive confirmation)
      const confirmedTargets: string[] = [];
      for (const target of targets) {
        const plugin = getPlugin(target, config.customTargets);
        const targetExists = plugin.targetExists(projectRoot);

        if (!targetExists) {
          let shouldCreate = false;
          if (options.force) {
            shouldCreate = true;
          } else {
            shouldCreate = await confirm({
              message: `${plugin.targetFile} doesn't exist. Create it?`,
              default: true,
            });
          }

          if (!shouldCreate) {
            info(`Skipping ${plugin.name}`);
            continue;
          }
        }

        confirmedTargets.push(target);
      }

      if (confirmedTargets.length === 0) {
        return;
      }

      await runSync({
        targets: confirmedTargets,
        lockfile,
        projectRoot,
        projectConfig: config,
        customTargets: config.customTargets,
        force: options.force,
        createTarget: true,
      });

      newline();
      success("Sync complete!");
    });
  });
