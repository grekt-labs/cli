import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { getConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile } from "#/context";
import { getPlugin, getAvailableTargets } from "#/sync/manager/manager";
import { runSync } from "#/sync/helpers/helpers";
import { syncFromDirectory } from "#/sync/standalone/standalone";
import { success, error, info, warning, log, newline, colors } from "#/shared/ui/ui";
import { withPromptHandler } from "#/shared/prompts/prompts";
import { syncToDashboard } from "#/dashboard/dashboard";

interface SyncCommandOptions {
  dryRun?: boolean;
  force?: boolean;
  target?: string;
  from?: string;
  name?: string;
}

export const syncCommand = new Command("sync")
  .description("Sync artifacts to AI tools")
  .option("--dry-run", "Preview changes without applying them")
  .option("-f, --force", "Skip confirmation prompts")
  .option("-t, --target <targets>", "Comma-separated list of targets")
  .option("--from <directory>", "Sync from a local directory (no project setup needed)")
  .option("--name <id>", "Artifact identifier (required with --from)")
  .action(async (options: SyncCommandOptions) => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      if (options.from) {
        await handleStandaloneSync(options, projectRoot);
        return;
      }

      if (options.name) {
        error("--name can only be used with --from");
        process.exit(1);
      }

      await handleProjectSync(options, projectRoot);
    });
  });

async function handleStandaloneSync(options: SyncCommandOptions, projectRoot: string): Promise<void> {
  if (!options.target) {
    error("--target is required when using --from");
    info(`Available targets: ${getAvailableTargets().join(", ")}`);
    process.exit(1);
  }

  if (!options.name) {
    error("--name is required when using --from");
    info("Example: grekt sync --from ./skills --name my-tool --target claude");
    process.exit(1);
  }

  const targets = options.target.split(",").map((t) => t.trim());

  if (options.dryRun) {
    log(colors.bold("Dry run - no changes will be made\n"));
  }

  try {
    const result = await syncFromDirectory({
      sourceDir: options.from!,
      artifactId: options.name,
      targets,
      projectRoot,
      dryRun: options.dryRun,
      force: options.force,
    });

    newline();

    if (options.dryRun) {
      info("Run without --dry-run to apply changes");
    } else if (result.totalCreated > 0 || result.totalUpdated > 0) {
      success("Sync complete!");
    } else {
      info("Nothing to sync");
    }
  } catch (err) {
    error((err as Error).message);
    process.exit(1);
  }
}

async function handleProjectSync(options: SyncCommandOptions, projectRoot: string): Promise<void> {
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

  await syncToDashboard(async (reporter) => {
    await reporter.reportProject(config, lockfile, projectRoot)
  })
}
