import type { ArtifactMode, ProjectConfig, Lockfile } from "@grekt-labs/cli-engine";

/**
 * Get the sync mode for an artifact.
 * Priority: lockfile > config > default (lazy)
 */
export function getArtifactMode(
  artifactId: string,
  config?: ProjectConfig,
  lockfile?: Lockfile,
): ArtifactMode {
  // First check lockfile (source of truth for installed artifacts)
  if (lockfile) {
    const lockEntry = lockfile.artifacts[artifactId];
    if (lockEntry?.mode) {
      return lockEntry.mode;
    }
  }

  // Fall back to config
  if (!config) return "lazy";

  const configEntry = config.artifacts[artifactId];
  if (!configEntry) return "lazy";

  if (typeof configEntry === "string") {
    return "lazy";
  }

  return configEntry.mode ?? "lazy";
}

/**
 * Check if an artifact should be synced (copied/symlinked to target).
 * Only CORE and CORE-SYM mode artifacts are synced. LAZY mode artifacts are only in the index.
 */
export function shouldSyncArtifact(
  artifactId: string,
  config?: ProjectConfig,
  lockfile?: Lockfile,
): boolean {
  const mode = getArtifactMode(artifactId, config, lockfile);
  return mode === "core" || mode === "core-sym";
}

/**
 * Check if an artifact should use symlinks instead of copies.
 */
export function shouldUseSymlinks(
  artifactId: string,
  config?: ProjectConfig,
  lockfile?: Lockfile,
): boolean {
  return getArtifactMode(artifactId, config, lockfile) === "core-sym";
}
