import { logger } from "#/shared/logger/logger";
import {
  createEmptySelection,
  isEmptySelection,
  isFullSelection,
  type ComponentSelection,
} from "#/artifact/selector/selector";
import { removeUnselectedFiles } from "#/artifact/component-manager/component-manager";
import { getLocalConfig } from "#/config/project/project";
import { resolveRegistry, createRegistryClient } from "#/registry/factory/factory";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource } from "#/registry/sources/sources";
import { fs, cryptoProvider, scanArtifact, hashDirectory } from "#/context";
import {
  CATEGORIES,
  compareSemver,
  calculateIntegrity,
  parseArtifactId,
  type ArtifactEntry,
  type ArtifactInfo,
  type Category,
  type LockfileEntry,
  type ProjectConfig,
} from "@grekt-labs/cli-engine";
import type {
  PreviousInstallation,
  StructureDiff,
  UpdateCheckResult,
  UpgradeResult,
  PerformUpgradeParams,
} from "./upgrade.types";

/**
 * Extract installation state from grekt.yaml config entry.
 * Returns null if the artifact is not installed.
 *
 * - String entry (e.g. "1.0.0") = full install, lazy mode
 * - Object with category arrays = partial install
 * - Object without category arrays = full install (just version + mode)
 */
export function getPreviousInstallation(
  artifactId: string,
  config: ProjectConfig
): PreviousInstallation | null {
  const entry = config.artifacts[artifactId];
  if (!entry) return null;

  // Simple string entry = full install, lazy mode
  if (typeof entry === "string") {
    return {
      version: entry,
      mode: "full",
      isCore: false,
    };
  }

  // Object entry - check if it has any category arrays
  const selection = extractSelection(entry);
  const hasSelection = CATEGORIES.some(
    (category) => selection[category].length > 0
  );

  if (!hasSelection) {
    // Object but no category arrays = full install (e.g. just version + mode)
    return {
      version: entry.version,
      mode: "full",
      isCore: entry.mode === "core",
    };
  }

  return {
    version: entry.version,
    mode: "partial",
    selection,
    isCore: entry.mode === "core",
  };
}

/**
 * Extract component selection from an artifact entry object.
 */
function extractSelection(
  entry: Exclude<ArtifactEntry, string>
): ComponentSelection {
  const selection = createEmptySelection();

  for (const category of CATEGORIES) {
    const paths = entry[category as keyof typeof entry];
    if (Array.isArray(paths)) {
      selection[category] = paths as string[];
    }
  }

  return selection;
}

/**
 * Compare a previous component selection against a new artifact version's components.
 * Returns which selected components were removed and which new components were added.
 */
export function computeStructureDiff(
  previousSelection: ComponentSelection,
  newArtifactInfo: ArtifactInfo
): StructureDiff {
  const removedComponents: Array<{ category: string; path: string }> = [];
  const addedComponents: Array<{ category: string; path: string }> = [];

  for (const category of CATEGORIES) {
    const previousPaths = previousSelection[category];
    const newPaths = new Set(
      newArtifactInfo[category].map((file) => file.path)
    );

    // Components the user selected that no longer exist
    for (const path of previousPaths) {
      if (!newPaths.has(path)) {
        removedComponents.push({ category, path });
      }
    }

    // New components that didn't exist before (not in any previous selection)
    const previousPathSet = new Set(previousPaths);
    for (const file of newArtifactInfo[category]) {
      if (!previousPathSet.has(file.path)) {
        addedComponents.push({ category, path: file.path });
      }
    }
  }

  return {
    removedComponents,
    addedComponents,
    hasStructuralChanges: removedComponents.length > 0 || addedComponents.length > 0,
  };
}

/**
 * Build a component selection that mirrors the previous one,
 * dropping any paths that no longer exist in the new artifact.
 */
export function buildSelectionFromPrevious(
  previousSelection: ComponentSelection,
  newArtifactInfo: ArtifactInfo
): ComponentSelection {
  const selection = createEmptySelection();

  for (const category of CATEGORIES) {
    const newPaths = new Set(
      newArtifactInfo[category].map((file) => file.path)
    );

    selection[category] = previousSelection[category].filter((path) =>
      newPaths.has(path)
    );
  }

  return selection;
}

/**
 * Check if a lockfile entry comes from a registry source (not git).
 */
export function isRegistrySource(entry: LockfileEntry): boolean {
  const source = entry.source || "";
  return !source.startsWith("github:") && !source.startsWith("gitlab:");
}

/**
 * Check if a newer version is available in the registry.
 * Uses the factory-based registry client to support custom registries.
 */
export async function checkForUpdate(
  artifactId: string,
  currentVersion: string,
  projectRoot: string
): Promise<UpdateCheckResult | null> {
  try {
    const { scope } = parseArtifactId(artifactId);
    const localConfig = getLocalConfig(projectRoot);
    const registry = resolveRegistry(scope, localConfig, projectRoot);
    const client = createRegistryClient(registry);

    const latestVersion = await client.getLatestVersion(artifactId);
    if (!latestVersion) return null;

    const isOutdated = compareSemver(currentVersion, latestVersion) < 0;
    return { isOutdated, latestVersion };
  } catch (err) {
    logger.debug("checkForUpdate failed:", artifactId, err);
    return null;
  }
}

/**
 * Perform the actual upgrade of a single artifact.
 * Pure logic: downloads, validates, replaces files, updates config/lockfile.
 * UI decisions (structural changes) are delegated via onStructuralChanges callback.
 * Mutates config and lockfile in place.
 */
export async function performUpgrade(params: PerformUpgradeParams): Promise<UpgradeResult> {
  const { artifactId, currentVersion, projectRoot, config, lockfile, onStructuralChanges } = params;
  const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
  const tempDir = `${projectRoot}/${ARTIFACTS_DIR}/.tmp-${cryptoProvider.randomUUID()}`;

  try {
    const source = parseSource(artifactId);

    fs.mkdir(tempDir, { recursive: true });
    const downloadResult = await downloadFromSource(source, tempDir, projectRoot);

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

    // Resolve component selection
    const previous = getPreviousInstallation(artifactId, config);

    let selection: ComponentSelection = createEmptySelection();
    for (const category of CATEGORIES) {
      selection[category] = artifactInfo[category].map((f) => f.path);
    }

    if (previous && previous.mode === "partial" && previous.selection) {
      const diff = computeStructureDiff(previous.selection, artifactInfo);

      if (diff.hasStructuralChanges) {
        selection = await onStructuralChanges(artifactId, diff, artifactInfo, previous.selection);

        if (isEmptySelection(selection)) {
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
        selection = buildSelectionFromPrevious(previous.selection, artifactInfo);
      }
    }

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
      deprecationMessage: downloadResult.deprecationMessage,
    };
  } catch (err) {
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
