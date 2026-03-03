import type { ComponentSelection } from "#/artifact/selector/selector";
import type { ProjectConfig, Lockfile, ArtifactMode } from "@grekt/engine";

export interface UpgradeResult {
  artifactId: string;
  fromVersion: string;
  toVersion: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  deprecationMessage?: string;
}

export interface PerformUpgradeParams {
  artifactId: string;
  currentVersion: string;
  projectRoot: string;
  config: ProjectConfig;
  lockfile: Lockfile;
  onStructuralChanges: (
    artifactId: string,
    diff: StructureDiff,
    artifactInfo: import("@grekt/engine").ArtifactInfo,
    previousSelection: ComponentSelection
  ) => Promise<ComponentSelection>;
}

/**
 * Represents a previously installed artifact's state,
 * extracted from grekt.yaml config entry.
 */
export interface PreviousInstallation {
  version: string;
  mode: "full" | "partial";
  selection?: ComponentSelection;
  isCore: boolean;
  artifactMode: ArtifactMode;
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
