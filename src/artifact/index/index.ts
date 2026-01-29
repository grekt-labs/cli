import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { ARTIFACTS_DIR, INDEX_FILE } from "#/config/paths/paths";
import { fs as cliFs, getLockfile } from "#/context";
import {
  scanArtifact,
  generateIndex,
  serializeIndex,
  type IndexGeneratorInput,
  type ArtifactMode,
  type ProjectConfig,
  type Lockfile,
} from "@grekt-labs/cli-engine";

/**
 * Get the sync mode for an artifact.
 * Priority: lockfile > config > default (lazy)
 */
function getArtifactMode(
  lockfile: Lockfile,
  config: ProjectConfig,
  artifactId: string
): ArtifactMode {
  // First check lockfile (source of truth for installed artifacts)
  const lockEntry = lockfile.artifacts[artifactId];
  if (lockEntry?.mode) {
    return lockEntry.mode;
  }

  // Fall back to config
  const configEntry = config.artifacts[artifactId];
  if (!configEntry) return "lazy";

  if (typeof configEntry === "string") {
    return "lazy"; // Version string = lazy mode
  }

  return configEntry.mode ?? "lazy";
}

/**
 * Scan all installed artifacts and generate the index file.
 * Includes ALL artifacts (CORE and LAZY) for observability.
 */
export function generateArtifactIndex(projectRoot: string, config: ProjectConfig): void {
  const artifactsDir = join(projectRoot, ARTIFACTS_DIR);
  const lockfile = getLockfile(projectRoot);
  const inputs: IndexGeneratorInput[] = [];

  // Only scan if artifacts directory exists
  if (existsSync(artifactsDir)) {
    // Get all artifact directories (scoped: @scope/name)
    const scopes = cliFs.readdir(artifactsDir);
    for (const scope of scopes) {
      if (!scope.startsWith("@")) continue;

      const scopeDir = join(artifactsDir, scope);
      const stat = cliFs.stat(scopeDir);
      if (!stat.isDirectory) continue;

      const names = cliFs.readdir(scopeDir);
      for (const name of names) {
        const artifactDir = join(scopeDir, name);
        const artifactStat = cliFs.stat(artifactDir);
        if (!artifactStat.isDirectory) continue;

        const artifactId = `${scope}/${name}`;
        const scanned = scanArtifact(cliFs, artifactDir);

        if (!scanned) continue;

        const mode = getArtifactMode(lockfile, config, artifactId);
        const keywords = scanned.manifest.keywords ?? [];

        inputs.push({
          artifactId,
          keywords,
          mode,
          components: {
            agents: scanned.agent ? [scanned.agent.path] : [],
            skills: scanned.skills.map((s) => s.path),
            commands: scanned.commands.map((c) => c.path),
            mcps: scanned.mcps.map((m) => m.path),
            rules: scanned.rules.map((r) => r.path),
          },
        });
      }
    }
  }

  // Generate and write the index (even if empty)
  // Include terminology for AIs that need term translation
  const index = generateIndex(inputs);
  const serialized = serializeIndex(index, { includeTerminology: true });
  const indexPath = join(projectRoot, INDEX_FILE);

  writeFileSync(indexPath, serialized, "utf-8");
}

/**
 * Create an empty index file.
 * Used during grekt init.
 */
export function createEmptyIndex(projectRoot: string): void {
  const index = generateIndex([]);
  const serialized = serializeIndex(index, { includeTerminology: true });
  const indexPath = join(projectRoot, INDEX_FILE);

  writeFileSync(indexPath, serialized, "utf-8");
}
