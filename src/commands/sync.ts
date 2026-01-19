import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { isInitialized, getProjectConfig } from "../lib/config.js";
import { getInstalled } from "../lib/installed.js";
import { getAdapter } from "../adapters/index.js";
import { success, error, info, warning, log, newline, colors, spinner } from "../utils/ui.js";
import type { SyncTarget } from "../schemas/index.js";

export const syncCommand = new Command("sync")
  .description("Sync artifacts to AI tools")
  .option("--dry-run", "Preview changes without applying them")
  .option("-f, --force", "Skip confirmation prompts")
  .option("-t, --target <targets>", "Comma-separated list of targets (claude,cursor,windsurf)")
  .action(async (options: { dryRun?: boolean; force?: boolean; target?: string }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const projectConfig = getProjectConfig(projectRoot);
    const installed = getInstalled(projectRoot);

    // Determine targets
    let targets: SyncTarget[] = projectConfig.targets;
    if (options.target) {
      targets = options.target.split(",").map((t) => t.trim()) as SyncTarget[];
    }

    if (targets.length === 0) {
      warning("No sync targets configured");
      info("Run 'grekt config set defaultTargets claude,cursor' or use --target flag");
      return;
    }

    const hasArtifacts = Object.keys(installed.agents).length > 0 || Object.keys(installed.skills).length > 0;

    if (!hasArtifacts) {
      info("No artifacts installed yet");
      info("Run 'grekt add <artifact>' to install artifacts first");
      return;
    }

    if (options.dryRun) {
      log(colors.bold("Dry run - no changes will be made\n"));
    }

    for (const target of targets) {
      const adapter = getAdapter(target);
      log(colors.bold(`\nSyncing ${adapter.name}...`));

      const targetExists = adapter.targetExists(projectRoot);

      // Ask to create target if it doesn't exist
      let createTarget = false;
      if (!targetExists && !options.dryRun) {
        if (options.force) {
          createTarget = true;
        } else {
          createTarget = await confirm({
            message: `${adapter.targetFile} doesn't exist. Create it?`,
            default: true,
          });
        }

        if (!createTarget) {
          info(`Skipping ${adapter.name}`);
          continue;
        }
      }

      // Preview or sync
      if (options.dryRun) {
        const preview = adapter.preview(installed, projectRoot);

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
        const spin = spinner(`Syncing ${adapter.name}...`);
        spin.start();

        const result = await adapter.sync(installed, projectRoot, {
          createTarget,
          force: options.force,
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
