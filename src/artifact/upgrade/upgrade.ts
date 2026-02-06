import { createEmptySelection, type ComponentSelection } from "#/artifact/selector/selector";
import { getLocalConfig } from "#/config/project/project";
import { resolveRegistry, createRegistryClient } from "#/registry/factory/factory";
import {
  CATEGORIES,
  compareSemver,
  parseArtifactId,
  type ArtifactEntry,
  type ArtifactInfo,
  type Category,
  type LockfileEntry,
  type ProjectConfig,
} from "@grekt-labs/cli-engine";
import type { PreviousInstallation, StructureDiff, UpdateCheckResult } from "./upgrade.types";

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
  } catch {
    return null;
  }
}
