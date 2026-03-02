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

/**
 * Detect the base ref to diff against.
 *
 * Priority:
 * 1. Explicit override via --since
 * 2. On feature branch: origin/<default-branch>
 * 3. On default branch: last tag, fallback HEAD~1
 */
export function detectBaseRef(overrideSince?: string): string {
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
    const lastTag = execOrNull(["describe", "--tags", "--abbrev=0"]);
    if (lastTag) return lastTag;

    warning("No tags found, falling back to HEAD~1");
    return "HEAD~1";
  }

  const hasRemote = execOrNull(["remote"]);
  if (hasRemote) {
    return `origin/${defaultBranch}`;
  }

  warning("No remote found, falling back to local refs");
  return defaultBranch;
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

function splitLines(output: string | null): string[] {
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Get files changed between base ref and HEAD.
 */
export function getChangedFiles(baseRef: string): string[] {
  const output =
    execOrNull(["diff", "--name-only", `${baseRef}...HEAD`]) ??
    execOrNull(["diff", "--name-only", baseRef, "HEAD"]);

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
