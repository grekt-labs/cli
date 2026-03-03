import { warning } from "#/shared/ui/ui";
import { exec, execOrNull, splitLines } from "#/shared/git/git";

export { detectArtifactBaseRef } from "#/shared/git/git";

function detectDefaultBranch(): string {
  const symbolicRef = execOrNull([
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
  ]);

  if (symbolicRef) {
    const parts = symbolicRef.split("/");
    return parts[parts.length - 1] ?? "main";
  }

  return "main";
}

/**
 * Detect the global base ref to diff against.
 *
 * Priority:
 * 1. Explicit override via --since
 * 2. On feature branch: origin/<default-branch>
 * 3. On default branch: resolved per artifact (returns null to signal this)
 */
export function detectBaseRef(overrideSince?: string): string | null {
  if (overrideSince) {
    const resolved = execOrNull(["rev-parse", "--verify", overrideSince]);
    if (!resolved) {
      throw new Error(`Invalid ref: ${overrideSince}`);
    }
    return overrideSince;
  }

  const currentBranch = execOrNull(["rev-parse", "--abbrev-ref", "HEAD"]);
  const defaultBranch = detectDefaultBranch();

  const isDefaultBranch =
    currentBranch === defaultBranch || currentBranch === "HEAD";

  if (isDefaultBranch) {
    return null;
  }

  const hasRemote = execOrNull(["remote"]);
  if (hasRemote) {
    return `origin/${defaultBranch}`;
  }

  warning("No remote found, falling back to local refs");
  return defaultBranch;
}

/**
 * Get files changed between base ref and HEAD.
 * Optionally scoped to a specific path.
 */
export function getChangedFiles(baseRef: string, path?: string): string[] {
  const baseArgs = ["diff", "--name-only"];
  const pathFilter = path ? ["--", path] : [];

  const output =
    execOrNull([...baseArgs, `${baseRef}...HEAD`, ...pathFilter]) ??
    execOrNull([...baseArgs, baseRef, "HEAD", ...pathFilter]);

  return splitLines(output);
}

/**
 * Get commit log lines for a specific path between base ref and HEAD.
 * Each line: "<hash> <subject>"
 */
export function getCommitsForPath(baseRef: string, path: string): string[] {
  const output = execOrNull([
    "log",
    "--format=%H %s",
    `${baseRef}..HEAD`,
    "--",
    path,
  ]);

  return splitLines(output);
}
