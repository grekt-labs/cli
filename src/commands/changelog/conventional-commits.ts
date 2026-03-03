import type { BumpType } from "@grekt/engine";
import type { WorkspaceArtifact } from "@grekt/engine";
import type { ConventionalCommit } from "./changelog.types";
import { normalizePath } from "#/shared/filesystem/filesystem";

const CONVENTIONAL_COMMIT_REGEX =
  /^([a-f0-9]+)\s+(\w+)(\(.+?\))?(!)?\s*:\s*(.+)$/;

/**
 * Parse a single git log line into a ConventionalCommit.
 * Returns null if the line doesn't match the conventional commit format.
 */
export function parseConventionalCommit(
  line: string,
): ConventionalCommit | null {
  if (line.includes("\0")) return null;

  const match = line.match(CONVENTIONAL_COMMIT_REGEX);
  if (!match) return null;

  const hash = match[1] ?? "";
  const type = match[2] ?? "";
  const scopeRaw = match[3];
  const bang = match[4];
  const message = match[5] ?? "";

  const scope = scopeRaw ? scopeRaw.slice(1, -1) : null;
  const breaking =
    bang === "!" || message.toUpperCase().includes("BREAKING CHANGE");

  return {
    hash,
    type,
    scope,
    breaking,
    message,
    raw: line,
  };
}

/**
 * Determine the bump type from a list of conventional commits.
 *
 * - Any breaking change -> major
 * - Any feat -> minor
 * - Everything else -> patch
 */
export function determineBumpType(commits: ConventionalCommit[]): BumpType {
  if (commits.some((commit) => commit.breaking)) return "major";
  if (commits.some((commit) => commit.type === "feat")) return "minor";
  return "patch";
}

/**
 * Map changed files to their respective workspace artifacts.
 * Matches file paths against artifact.relativePath prefix.
 */
export function mapFilesToArtifacts(
  changedFiles: string[],
  artifacts: WorkspaceArtifact[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const file of changedFiles) {
    for (const artifact of artifacts) {
      const normalized = normalizePath(artifact.relativePath);
      const prefix = normalized.endsWith("/")
        ? normalized
        : `${normalized}/`;

      if (file.startsWith(prefix)) {
        const existing = result.get(artifact.relativePath) ?? [];
        existing.push(file);
        result.set(artifact.relativePath, existing);
        break;
      }
    }
  }

  return result;
}
