import { shell } from "#/context";
import { warning } from "#/shared/ui/ui";

function exec(args: string[]): string {
  return shell.execFile("git", args).trim();
}

function execOrNull(args: string[]): string | null {
  try {
    const result = exec(args);
    return result || null;
  } catch {
    return null;
  }
}

function splitLines(output: string | null): string[] {
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

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

function getFirstCommit(): string | null {
  return execOrNull(["rev-list", "--max-parents=0", "HEAD"]);
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

  const firstCommit = getFirstCommit();
  if (firstCommit) return firstCommit;

  warning(`${artifactName}: no tags found, falling back to HEAD~1`);
  return "HEAD~1";
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
