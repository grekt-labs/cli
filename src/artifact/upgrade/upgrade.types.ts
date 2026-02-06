import type { ComponentSelection } from "#/artifact/selector/selector";

/**
 * Represents a previously installed artifact's state,
 * extracted from grekt.yaml config entry.
 */
export interface PreviousInstallation {
  version: string;
  mode: "full" | "partial";
  selection?: ComponentSelection;
  isCore: boolean;
}

/**
 * Describes structural differences between a previous selection
 * and a new artifact version's components.
 */
export interface StructureDiff {
  removedComponents: Array<{ category: string; path: string }>;
  addedComponents: Array<{ category: string; path: string }>;
  hasStructuralChanges: boolean;
}

/**
 * Result from checking if an artifact has a newer version available.
 */
export interface UpdateCheckResult {
  isOutdated: boolean;
  latestVersion: string;
}
