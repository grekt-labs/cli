import { join } from "path";
import { ARTIFACTS_DIR, INDEX_FILE } from "#/config/paths/paths";
import { fs, getLockfile } from "#/context";
import {
  scanArtifact,
  generateIndex,
  serializeIndex,
  CATEGORIES,
  createCategoryRecord,
  type IndexGeneratorInput,
  type ProjectConfig,
  type Lockfile,
  type CategoryFilePaths,
} from "@grekt/engine";
import { getArtifactMode } from "#/artifact/mode/mode";

/**
 * Scan all installed artifacts and generate the index file.
 * Includes ALL artifacts (CORE and LAZY) for observability.
 */
export function generateArtifactIndex(projectRoot: string, config: ProjectConfig, lockfile?: Lockfile): void {
  const artifactsDir = join(projectRoot, ARTIFACTS_DIR);
  lockfile ??= getLockfile(projectRoot);
  const inputs: IndexGeneratorInput[] = [];

  // Only scan if artifacts directory exists
  if (fs.exists(artifactsDir)) {
    // Get all artifact directories (scoped: @scope/name)
    const scopes = fs.readdir(artifactsDir);
    for (const scope of scopes) {
      if (!scope.startsWith("@")) continue;

      const scopeDir = join(artifactsDir, scope);
      const stat = fs.stat(scopeDir);
      if (!stat.isDirectory) continue;

      const names = fs.readdir(scopeDir);
      for (const name of names) {
        const artifactDir = join(scopeDir, name);
        const artifactStat = fs.stat(artifactDir);
        if (!artifactStat.isDirectory) continue;

        const artifactId = `${scope}/${name}`;
        const scanned = scanArtifact(fs, artifactDir);

        if (!scanned) continue;

        const mode = getArtifactMode(artifactId, config, lockfile);
        const keywords = scanned.manifest.keywords ?? [];

        // Build components map dynamically from categories
        const components = createCategoryRecord<string[]>(() => []);
        for (const category of CATEGORIES) {
          components[category] = scanned[category].map((f) => f.path);
        }

        inputs.push({
          artifactId,
          keywords,
          mode,
          components,
        });
      }
    }
  }

  // Generate and write the index (even if empty)
  // Include terminology for AIs that need term translation
  const index = generateIndex(inputs);
  const serialized = serializeIndex(index, { includeTerminology: true });
  const indexPath = join(projectRoot, INDEX_FILE);

  fs.writeFile(indexPath, serialized);
}

/**
 * Create an empty index file.
 * Used during grekt init.
 */
export function createEmptyIndex(projectRoot: string): void {
  const index = generateIndex([]);
  const serialized = serializeIndex(index, { includeTerminology: true });
  const indexPath = join(projectRoot, INDEX_FILE);

  fs.writeFile(indexPath, serialized);
}
