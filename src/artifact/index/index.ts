import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { ARTIFACTS_DIR, INDEX_FILE } from "#/config/paths/paths";
import { fs as cliFs } from "#/context";
import {
  scanArtifact,
  generateIndex,
  serializeIndex,
  type IndexGeneratorInput,
  type ArtifactMode,
  type ProjectConfig,
} from "@grekt-labs/cli-engine";

/**
 * Get the sync mode for an artifact from the project config.
 * Default is "lazy" if not specified.
 */
function getArtifactMode(config: ProjectConfig, artifactId: string): ArtifactMode {
  const entry = config.artifacts[artifactId];
  if (!entry) return "lazy";

  if (typeof entry === "string") {
    return "lazy"; // Version string = lazy mode
  }

  return entry.mode ?? "lazy";
}

/**
 * Scan all installed artifacts and generate the index file.
 * Only LAZY artifacts are indexed - CORE artifacts are already in AI context.
 */
export function generateArtifactIndex(projectRoot: string, config: ProjectConfig): void {
  const artifactsDir = join(projectRoot, ARTIFACTS_DIR);
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

        const mode = getArtifactMode(config, artifactId);

        // Only index LAZY artifacts - CORE artifacts are already in context
        if (mode === "core") continue;

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
  const index = generateIndex(inputs);
  const serialized = serializeIndex(index);
  const indexPath = join(projectRoot, INDEX_FILE);

  writeFileSync(indexPath, serialized, "utf-8");
}

/**
 * Create an empty index file.
 * Used during grekt init.
 */
export function createEmptyIndex(projectRoot: string): void {
  const index = generateIndex([]);
  const serialized = serializeIndex(index);
  const indexPath = join(projectRoot, INDEX_FILE);

  writeFileSync(indexPath, serialized, "utf-8");
}
