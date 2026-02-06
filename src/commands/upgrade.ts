import { Command } from "commander";
import { getConfig, saveConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile, saveLockfile } from "#/context";
import { selectComponentsWithPrecheck } from "#/artifact/selector/selector";
import { generateArtifactIndex } from "#/artifact/index/index";
import {
  isRegistrySource,
  checkForUpdate,
  performUpgrade,
} from "#/artifact/upgrade/upgrade";
import type { UpgradeResult } from "#/artifact/upgrade/upgrade.types";
import { success, error, info, log, warning, newline, colors, spinner } from "#/shared/ui/ui";
import { getPlugin } from "#/sync/manager/manager";

export const upgradeCommand = new Command("upgrade")
  .description("Upgrade artifacts to their latest versions (registry only)")
  .argument("[artifact]", "Specific artifact to upgrade (e.g., @scope/name)")
  .action(async (artifactArg: string | undefined) => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    const lockfile = getLockfile(projectRoot);
    const config = getConfig(projectRoot);
    const allArtifacts = Object.entries(lockfile.artifacts);

    if (allArtifacts.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    const artifactsToCheck = resolveArtifactsToCheck(artifactArg, allArtifacts);

    // Check for updates
    const spin = spinner("Checking for updates...");
    spin.start();

    const outdatedArtifacts: Array<{
      artifactId: string;
      currentVersion: string;
      latestVersion: string;
    }> = [];

    for (const [artifactId, entry] of artifactsToCheck) {
      const result = await checkForUpdate(artifactId, entry.version, projectRoot);
      if (result && result.isOutdated) {
        outdatedArtifacts.push({
          artifactId,
          currentVersion: entry.version,
          latestVersion: result.latestVersion,
        });
      }
    }

    spin.stop();

    if (outdatedArtifacts.length === 0) {
      if (artifactArg) {
        info(`${colors.highlight(artifactArg)} is already up to date`);
      } else {
        log(colors.success("All artifacts are up to date"));
      }
      process.exit(0);
    }

    // Show what will be upgraded
    newline();
    log(colors.bold(`Upgrading ${outdatedArtifacts.length} artifact(s):`));
    newline();
    for (const { artifactId, currentVersion, latestVersion } of outdatedArtifacts) {
      log(`  ${colors.highlight(artifactId)}: ${currentVersion} ${colors.dim("->")} ${latestVersion}`);
    }
    newline();

    // Upgrade each artifact
    const results: UpgradeResult[] = [];

    for (const { artifactId, currentVersion } of outdatedArtifacts) {
      const downloadSpin = spinner(`Downloading ${colors.highlight(artifactId)}...`);
      downloadSpin.start();

      const result = await performUpgrade({
        artifactId,
        currentVersion,
        projectRoot,
        config,
        lockfile,
        onStructuralChanges: async (id, diff, artifactInfo, previousSelection) => {
          downloadSpin.stop();

          newline();
          log(`${colors.highlight(id)}: structural changes detected`);

          if (diff.removedComponents.length > 0) {
            log(colors.dim("  Removed components:"));
            for (const { category, path } of diff.removedComponents) {
              log(`    ${colors.warning("-")} ${category}/${path}`);
            }
          }

          if (diff.addedComponents.length > 0) {
            log(colors.dim("  New components:"));
            for (const { category, path } of diff.addedComponents) {
              log(`    ${colors.success("+")} ${category}/${path}`);
            }
          }

          newline();

          return selectComponentsWithPrecheck(artifactInfo, previousSelection);
        },
      });

      downloadSpin.stop();

      if (result.deprecationMessage) {
        warning(`${colors.highlight(artifactId)}: ${result.deprecationMessage}`);
      }

      results.push(result);
    }

    // Save config and lockfile after all upgrades
    saveConfig(config, projectRoot);
    saveLockfile(lockfile, projectRoot);

    // Regenerate index
    generateArtifactIndex(projectRoot, config);

    // Auto-sync to targets
    syncToTargets(config, lockfile, projectRoot);

    // Summary
    displayUpgradeSummary(results);
  });

/**
 * Determine which artifacts to check for updates.
 */
function resolveArtifactsToCheck(
  artifactArg: string | undefined,
  allArtifacts: Array<[string, { version: string; source?: string; mode?: string }]>
) {
  if (artifactArg) {
    const normalizedId = artifactArg.startsWith("@") ? artifactArg : `@${artifactArg}`;
    const entry = allArtifacts.find(([id]) => id === normalizedId);

    if (!entry) {
      error(`Artifact ${colors.highlight(normalizedId)} is not installed`);
      process.exit(1);
    }

    if (!isRegistrySource(entry[1] as Parameters<typeof isRegistrySource>[0])) {
      error(`${colors.highlight(normalizedId)} was installed from a git source`);
      info("Git-sourced artifacts cannot be upgraded with this command");
      info("Use git pull in the artifact directory instead");
      process.exit(1);
    }

    return [entry];
  }

  const registryArtifacts = allArtifacts.filter(([_, entry]) =>
    isRegistrySource(entry as Parameters<typeof isRegistrySource>[0])
  );

  if (registryArtifacts.length === 0) {
    info("No registry artifacts to upgrade (all artifacts are from git sources)");
    process.exit(0);
  }

  return registryArtifacts;
}

/**
 * Sync upgraded artifacts to all configured targets.
 */
async function syncToTargets(
  config: ReturnType<typeof getConfig>,
  lockfile: ReturnType<typeof getLockfile>,
  projectRoot: string
) {
  if (config.targets.length === 0) return;

  newline();
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

/**
 * Display upgrade results summary.
 */
function displayUpgradeSummary(results: UpgradeResult[]) {
  newline();
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success && !r.skipped);
  const skipped = results.filter((r) => r.skipped);

  if (succeeded.length > 0) {
    log(colors.bold("Upgraded:"));
    for (const result of succeeded) {
      success(`${colors.highlight(result.artifactId)}: ${result.fromVersion} -> ${result.toVersion}`);
    }
  }

  if (skipped.length > 0) {
    newline();
    log(colors.bold("Skipped:"));
    for (const result of skipped) {
      warning(`${colors.highlight(result.artifactId)}: ${result.reason}`);
    }
  }

  if (failed.length > 0) {
    newline();
    log(colors.bold("Failed:"));
    for (const result of failed) {
      error(`${colors.highlight(result.artifactId)}: ${result.reason}`);
    }
  }
}
