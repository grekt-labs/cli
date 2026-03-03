import type { Lockfile, ProjectConfig, CustomTarget, SyncPlugin } from "@grekt/engine";
import { getPlugin } from "#/sync/manager/manager";
import { saveLockfile } from "#/context";
import { success, info, warning, log, colors, symbols, spinner } from "#/shared/ui/ui";
import { isSkipReason, extractSkippedPath } from "#/sync/skip-reason/skip-reason";

type PluginResolver = (target: string, customTargets?: Record<string, CustomTarget>) => SyncPlugin;

export interface RunSyncOptions {
  targets: string[];
  lockfile: Lockfile;
  projectRoot: string;
  projectConfig: ProjectConfig;
  customTargets?: Record<string, CustomTarget>;
  force?: boolean;
  createTarget?: boolean;
  resolvePlugin?: PluginResolver;
}

export interface RunSyncResult {
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
}

/**
 * Core sync execution logic, reusable across commands.
 * Iterates over targets, resolves plugins, and runs sync.
 */
export async function runSync(options: RunSyncOptions): Promise<RunSyncResult> {
  const {
    targets,
    lockfile,
    projectRoot,
    projectConfig,
    customTargets,
    force = false,
    createTarget = true,
    resolvePlugin = getPlugin,
  } = options;

  const result: RunSyncResult = {
    totalCreated: 0,
    totalUpdated: 0,
    totalSkipped: 0,
  };

  let lockfileChanged = false;

  for (const target of targets) {
    const plugin = resolvePlugin(target, customTargets);
    log(colors.bold(`\nSyncing ${plugin.name}...`));

    const targetExists = plugin.targetExists(projectRoot);

    if (!targetExists && !createTarget) {
      info(`Skipping ${plugin.name} (target not found)`);
      continue;
    }

    const spin = spinner(`Syncing ${plugin.name}...`);
    spin.start();

    const syncResult = await plugin.sync(lockfile, projectRoot, {
      createTarget: !targetExists,
      force,
      projectConfig,
    });

    spin.stop();

    // Merge synced file hashes into lockfile entries
    for (const [artifactId, fileHashes] of Object.entries(syncResult.syncedFiles)) {
      const entry = lockfile.artifacts[artifactId];
      if (!entry) continue;

      if (!entry.synced) {
        entry.synced = {};
      }
      entry.synced[plugin.id] = fileHashes;
      lockfileChanged = true;
    }

    for (const file of syncResult.created) {
      success(`Created ${file}`);
      result.totalCreated++;
    }

    for (const file of syncResult.updated) {
      info(`Updated ${file}`);
      result.totalUpdated++;
    }

    const lazyItems: string[] = [];
    const skippedItems: string[] = [];

    for (const entry of syncResult.skipped) {
      if (isSkipReason(entry, "lazy")) {
        lazyItems.push(extractSkippedPath(entry, "lazy"));
      } else {
        skippedItems.push(entry);
      }
    }

    for (const file of skippedItems) {
      warning(`Skipped ${file}`);
      result.totalSkipped++;
    }

    if (lazyItems.length > 0) {
      log(colors.dim("\nLazy mode (not synced):"));
      for (const item of lazyItems) {
        log(`  ${symbols.bullet} ${colors.dim(item)}`);
      }
      result.totalSkipped += lazyItems.length;
    }
  }

  if (lockfileChanged) {
    saveLockfile(lockfile, projectRoot);
  }

  return result;
}

/**
 * Sync artifacts to all configured targets.
 * Convenience wrapper for add/upgrade commands that sync all targets with force.
 */
export async function syncToTargets(
  config: ProjectConfig,
  lockfile: Lockfile,
  projectRoot: string
): Promise<void> {
  if (config.targets.length === 0) return;

  await runSync({
    targets: config.targets,
    lockfile,
    projectRoot,
    projectConfig: config,
    customTargets: config.customTargets,
    force: true,
    createTarget: true,
  });
}
