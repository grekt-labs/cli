import type { ProjectConfig, ArtifactEntry, Lockfile } from "@grekt-labs/cli-engine";
import type { ReconcileResult, ReconcileEntry } from "./reconcile.types";

/**
 * Extract version string from an artifact config entry.
 * Config entries can be either a plain version string ("1.0.0")
 * or an object with a version field ({ version: "1.0.0", mode: "core", ... }).
 */
export function extractVersion(entry: ArtifactEntry): string {
  return typeof entry === "string" ? entry : entry.version;
}

/**
 * Extract mode from a config entry.
 * Simple string entries default to "lazy".
 */
export function extractMode(entry: ArtifactEntry): "lazy" | "core" | "core-sym" {
  if (typeof entry === "string") return "lazy";
  return entry.mode ?? "lazy";
}

/**
 * Compare config (grekt.yaml) against lockfile (grekt.lock) and produce
 * a reconciliation plan describing what needs to happen for each artifact.
 *
 * Pure function — no I/O, no side effects.
 */
export function reconcile(
  configArtifacts: ProjectConfig["artifacts"],
  lockfileArtifacts: Lockfile["artifacts"]
): ReconcileResult {
  const toKeep: ReconcileEntry[] = [];
  const toResolve: ReconcileEntry[] = [];
  const toPrune: ReconcileEntry[] = [];

  // Process artifacts in config
  for (const [artifactId, configEntry] of Object.entries(configArtifacts)) {
    const configVersion = extractVersion(configEntry);
    const lockfileEntry = lockfileArtifacts[artifactId];

    if (!lockfileEntry) {
      toResolve.push({
        artifactId,
        action: "resolve",
        source: artifactId,
        configVersion,
        reason: "new artifact",
      });
      continue;
    }

    if (lockfileEntry.version === configVersion) {
      toKeep.push({
        artifactId,
        action: "keep",
        lockfileEntry,
        source: lockfileEntry.source ?? artifactId,
        configVersion,
        reason: "version matches lockfile",
      });
    } else {
      toResolve.push({
        artifactId,
        action: "resolve",
        lockfileEntry,
        source: lockfileEntry.source ?? artifactId,
        configVersion,
        reason: `version changed ${lockfileEntry.version} → ${configVersion}`,
      });
    }
  }

  // Find artifacts in lockfile that are not in config (prunable)
  for (const [artifactId, lockfileEntry] of Object.entries(lockfileArtifacts)) {
    if (!(artifactId in configArtifacts)) {
      toPrune.push({
        artifactId,
        action: "prune",
        lockfileEntry,
        source: lockfileEntry.source ?? artifactId,
        reason: "removed from config",
      });
    }
  }

  return { toKeep, toResolve, toPrune };
}
