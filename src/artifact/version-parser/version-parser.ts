/**
 * Parse an artifact@version string into its components.
 * Expected format: @scope/name@version (e.g., @grekt/code-reviewer@1.0.0)
 * Returns null if format is invalid.
 */

const ARTIFACT_AT_VERSION = /^(?<artifactId>@[^@]+)@(?<version>.+)$/;

export interface ParsedArtifactVersion {
  artifactId: string;
  version: string;
}

export function parseArtifactVersion(input: string): ParsedArtifactVersion | null {
  const match = input.match(ARTIFACT_AT_VERSION);
  if (!match?.groups?.artifactId || !match?.groups?.version) return null;

  return {
    artifactId: match.groups.artifactId,
    version: match.groups.version,
  };
}
