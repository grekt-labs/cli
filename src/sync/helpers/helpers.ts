import type { Lockfile, ProjectConfig } from "@grekt-labs/cli-engine";
import { getPlugin } from "#/sync/manager/manager";
import { success, info, warning, spinner } from "#/shared/ui/ui";

/**
 * Sync artifacts to all configured targets.
 * Shared between add and upgrade commands.
 */
export async function syncToTargets(
  config: ProjectConfig,
  lockfile: Lockfile,
  projectRoot: string
): Promise<void> {
  if (config.targets.length === 0) return;

  for (const target of config.targets) {
    const plugin = getPlugin(target, config.customTargets);
    const syncSpin = spinner(`Syncing ${plugin.name}...`);
    syncSpin.start();

    const syncResult = await plugin.sync(lockfile, projectRoot, {
      createTarget: true,
      force: true,
      projectConfig: config,
    });

    syncSpin.stop();

    for (const file of syncResult.created) {
      success(`Created ${file}`);
    }
    for (const file of syncResult.updated) {
      info(`Updated ${file}`);
    }
    for (const file of syncResult.skipped) {
      warning(`Skipped ${file}`);
    }
  }
}
