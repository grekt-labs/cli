import { basename } from "path";

/**
 * Create a namespaced filename to avoid collisions between artifacts.
 * Used when syncing artifacts to target directories.
 *
 * @example getSafeFilename("@grekt/analyzer", "skills/analyze.md") → "grekt-analyzer_analyze.md"
 * @example getSafeFilename("my-artifact", "agent.md") → "my-artifact_agent.md"
 */
export function getSafeFilename(artifactId: string, filepath: string): string {
  const safeName = artifactId.replace("@", "").replace("/", "-");
  const filename = basename(filepath);
  return `${safeName}_${filename}`;
}

/**
 * Convert artifact ID to safe directory/file name format.
 * Removes @ prefix and replaces / with -
 *
 * @example toSafeName("@grekt/analyzer") → "grekt-analyzer"
 */
export function toSafeName(artifactId: string): string {
  return artifactId.replace("@", "").replace("/", "-");
}
