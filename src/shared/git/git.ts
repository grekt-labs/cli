import { shell } from "#/context";
import { warning } from "#/shared/ui/ui";

export function exec(args: string[]): string {
  return shell.execFile("git", args).trim();
}

export function execOrNull(args: string[]): string | null {
  try {
    const result = exec(args);
    return result || null;
  } catch {
    return null;
  }
}

export function splitLines(output: string | null): string[] {
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Detect base ref for a specific artifact on the default branch.
 * Looks for tags matching the artifact name pattern (e.g. @scope/name@1.0.0).
 * Falls back to the first commit in the repo.
 */
export function detectArtifactBaseRef(artifactName: string): string {
  const lastTag = execOrNull([
    "describe",
    "--tags",
    "--abbrev=0",
    "--match",
    `${artifactName}@*`,
  ]);

  if (lastTag) return lastTag;

  const firstCommit = execOrNull(["rev-list", "--max-parents=0", "HEAD"]);
  if (firstCommit) return firstCommit;

  warning(`${artifactName}: no tags found, falling back to HEAD~1`);
  return "HEAD~1";
}

/**
 * Create a git tag for a published artifact.
 * Format: `@scope/name@version` — matches what `detectArtifactBaseRef` looks for.
 */
export function createArtifactTag(artifactName: string, version: string): void {
  const tag = `${artifactName}@${version}`;
  exec(["tag", tag]);
}
