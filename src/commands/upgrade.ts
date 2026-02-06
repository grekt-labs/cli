import { Command } from "commander";
import { getConfig, saveConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { fs, cryptoProvider } from "#/context";
import { getLockfile, saveLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource } from "#/registry/sources/sources";
import { scanArtifact, hashDirectory } from "#/context";
import { parseName, calculateIntegrity, compareSemver, CATEGORIES, type Category } from "@grekt-labs/cli-engine";
import {
  selectComponentsWithPrecheck,
  isEmptySelection,
  isFullSelection,
  createEmptySelection,
  type ComponentSelection,
} from "#/artifact/selector/selector";
import { removeUnselectedFiles } from "#/artifact/component-manager/component-manager";
import { generateArtifactIndex } from "#/artifact/index/index";
import { assertSafeArtifactId } from "#/artifact/validation/validation";
import {
  getPreviousInstallation,
  computeStructureDiff,
  buildSelectionFromPrevious,
  isRegistrySource,
  checkForUpdate,
} from "#/artifact/upgrade/upgrade";
import { success, error, info, log, warning, newline, colors, spinner } from "#/shared/ui/ui";
import { getPlugin } from "#/sync/manager/manager";

interface UpgradeResult {
  artifactId: string;
  fromVersion: string;
  toVersion: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

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

    // Determine which artifacts to upgrade
    let artifactsToCheck: Array<[string, (typeof lockfile.artifacts)[string]]>;

    if (artifactArg) {
      // Specific artifact
      const normalizedId = artifactArg.startsWith("@") ? artifactArg : `@${artifactArg}`;
      const entry = lockfile.artifacts[normalizedId];

      if (!entry) {
        error(`Artifact ${colors.highlight(normalizedId)} is not installed`);
        process.exit(1);
      }

      if (!isRegistrySource(entry)) {
        error(`${colors.highlight(normalizedId)} was installed from a git source`);
        info("Git-sourced artifacts cannot be upgraded with this command");
        info("Use git pull in the artifact directory instead");
        process.exit(1);
      }

      artifactsToCheck = [[normalizedId, entry]];
    } else {
      // All registry artifacts
      artifactsToCheck = allArtifacts.filter(([_, entry]) =>
        isRegistrySource(entry)
      );

      if (artifactsToCheck.length === 0) {
        info("No registry artifacts to upgrade (all artifacts are from git sources)");
        process.exit(0);
      }
    }

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

    for (const { artifactId, currentVersion, latestVersion } of outdatedArtifacts) {
      const result = await upgradeArtifact(
        artifactId,
        currentVersion,
        projectRoot,
        config,
        lockfile
      );
      results.push(result);
    }

    // Save config and lockfile after all upgrades
    saveConfig(config, projectRoot);
    saveLockfile(lockfile, projectRoot);

    // Regenerate index
    generateArtifactIndex(projectRoot, config);

    // Auto-sync to targets
    if (config.targets.length > 0) {
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

    // Summary
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
  });

/**
 * Upgrade a single artifact to the latest version.
 * Mutates config and lockfile in place.
 */
async function upgradeArtifact(
  artifactId: string,
  currentVersion: string,
  projectRoot: string,
  config: ReturnType<typeof getConfig>,
  lockfile: ReturnType<typeof getLockfile>
): Promise<UpgradeResult> {
  const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
  const tempDir = `${projectRoot}/${ARTIFACTS_DIR}/.tmp-${cryptoProvider.randomUUID()}`;

  try {
    // Download new version
    const source = parseSource(artifactId);
    const downloadSpin = spinner(`Downloading ${colors.highlight(artifactId)}...`);
    downloadSpin.start();

    fs.mkdir(tempDir, { recursive: true });
    const downloadResult = await downloadFromSource(source, tempDir, projectRoot);

    downloadSpin.stop();

    if (!downloadResult.success) {
      fs.rmdir(tempDir, { recursive: true });
      return {
        artifactId,
        fromVersion: currentVersion,
        toVersion: "",
        success: false,
        reason: downloadResult.error || "Download failed",
      };
    }

    if (downloadResult.deprecationMessage) {
      warning(`${colors.highlight(artifactId)}: ${downloadResult.deprecationMessage}`);
    }

    // Scan the downloaded artifact
    const artifactInfo = scanArtifact(tempDir);
    if (!artifactInfo) {
      fs.rmdir(tempDir, { recursive: true });
      return {
        artifactId,
        fromVersion: currentVersion,
        toVersion: "",
        success: false,
        reason: "Invalid artifact structure",
      };
    }

    const newVersion = artifactInfo.manifest.version;

    // Double-check version is actually newer
    if (compareSemver(newVersion, currentVersion) <= 0) {
      fs.rmdir(tempDir, { recursive: true });
      return {
        artifactId,
        fromVersion: currentVersion,
        toVersion: currentVersion,
        success: false,
        skipped: true,
        reason: "Already up to date",
      };
    }

    // Get previous installation info
    const previous = getPreviousInstallation(artifactId, config);

    // Determine selection
    let selection: ComponentSelection = createEmptySelection();
    for (const category of CATEGORIES) {
      selection[category] = artifactInfo[category].map((f) => f.path);
    }

    if (previous && previous.mode === "partial" && previous.selection) {
      const diff = computeStructureDiff(previous.selection, artifactInfo);

      if (diff.hasStructuralChanges) {
        // Inform the user about structural changes
        newline();
        log(`${colors.highlight(artifactId)}: structural changes detected`);

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

        // Re-trigger selection with previous as precheck
        selection = await selectComponentsWithPrecheck(artifactInfo, previous.selection);

        if (isEmptySelection(selection)) {
          warning("No components selected, keeping old version");
          fs.rmdir(tempDir, { recursive: true });
          return {
            artifactId,
            fromVersion: currentVersion,
            toVersion: currentVersion,
            success: false,
            skipped: true,
            reason: "No components selected",
          };
        }
      } else {
        // No structural changes - silently apply previous selection
        selection = buildSelectionFromPrevious(previous.selection, artifactInfo);
      }
    }
    // Full install: selection stays as all components (default)

    // Replace old artifact with new
    if (fs.exists(targetDir)) {
      fs.rmdir(targetDir, { recursive: true });
    }

    const parentDir = targetDir.substring(0, targetDir.lastIndexOf("/"));
    if (!fs.exists(parentDir)) {
      fs.mkdir(parentDir, { recursive: true });
    }

    fs.rename(tempDir, targetDir);

    // Remove unselected files if partial
    const allSelected = isFullSelection(artifactInfo, selection);
    if (!allSelected) {
      removeUnselectedFiles(targetDir, artifactInfo, selection);
    }

    // Update config entry
    const isCore = previous?.isCore ?? false;

    if (allSelected && !isCore) {
      config.artifacts[artifactId] = artifactInfo.manifest.version;
    } else {
      const entry: Record<string, unknown> = {
        version: artifactInfo.manifest.version,
      };
      if (isCore) entry.mode = "core";
      for (const category of CATEGORIES) {
        if (selection[category].length > 0) {
          entry[category] = selection[category];
        }
      }
      config.artifacts[artifactId] = entry as (typeof config.artifacts)[string];
    }

    // Update lockfile
    const fileHashes = hashDirectory(targetDir);
    const integrity = calculateIntegrity(fileHashes);
    const previousLockEntry = lockfile.artifacts[artifactId];

    lockfile.artifacts[artifactId] = {
      version: artifactInfo.manifest.version,
      integrity,
      source: previousLockEntry?.source || artifactId,
      resolved: downloadResult.resolved,
      mode: isCore ? "core" : (previousLockEntry?.mode ?? "lazy"),
      files: fileHashes,
    };

    return {
      artifactId,
      fromVersion: currentVersion,
      toVersion: newVersion,
      success: true,
    };
  } catch (err) {
    // Clean up temp dir on error
    if (fs.exists(tempDir)) {
      fs.rmdir(tempDir, { recursive: true });
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      artifactId,
      fromVersion: currentVersion,
      toVersion: "",
      success: false,
      reason: message,
    };
  }
}
