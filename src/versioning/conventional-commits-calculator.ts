/**
 * Conventional Commits Calculator
 *
 * Lightweight implementation that analyzes git commits and calculates
 * version bumps based on conventional commits format.
 *
 * No external dependencies - works in any environment with git.
 */

import { execSync } from "child_process";
import { bumpVersion, type BumpType } from "@grekt-labs/cli-engine";
import type { VersionResult } from "@grekt-labs/cli-engine";
import type { VersionCalculator, CalculateOptions } from "./calculator.types";

// Conventional commit regex with explicit types
const VALID_TYPES = ["feat", "fix", "chore", "docs", "refactor", "perf", "test", "build", "ci", "style", "revert"];
const CONVENTIONAL_COMMIT_REGEX = new RegExp(
  `^(${VALID_TYPES.join("|")})(?:\\(([^)]+)\\))?(!)?:\\s+(.+)$`
);

// Types that trigger a patch bump (configurable in future)
const PATCH_TYPES = ["fix", "perf", "refactor"];

// Types that are ignored for versioning (docs, tests, etc.)
const IGNORED_TYPES = ["docs", "style", "test", "build", "ci", "chore"];

interface ParsedCommit {
  type: string;
  scope?: string;
  breaking: boolean;
  description: string;
}

interface CommitInfo {
  subject: string;
  body: string;
}

/**
 * Parse a commit into conventional commit parts
 */
function parseCommit(commit: CommitInfo): ParsedCommit | null {
  const match = commit.subject.match(CONVENTIONAL_COMMIT_REGEX);
  if (!match) return null;

  const [, type, scope, bangBreaking, description] = match;

  // Check for breaking change in subject (!) or body (BREAKING CHANGE:)
  const breaking = bangBreaking === "!" ||
    commit.body.includes("BREAKING CHANGE:") ||
    commit.body.includes("BREAKING-CHANGE:");

  return {
    type: type!.toLowerCase(),
    scope: scope?.toLowerCase(),
    breaking,
    description: description!,
  };
}

/**
 * Determine bump type from parsed commits
 */
function determineBumpType(commits: ParsedCommit[]): BumpType | null {
  if (commits.length === 0) return null;

  // Check for breaking changes -> major
  if (commits.some(c => c.breaking)) {
    return "major";
  }

  // Check for features -> minor
  if (commits.some(c => c.type === "feat")) {
    return "minor";
  }

  // Check for patch-worthy changes
  if (commits.some(c => PATCH_TYPES.includes(c.type))) {
    return "patch";
  }

  // Ignored types (docs, tests, etc.) don't trigger version bump
  return null;
}

/**
 * Get commits with subject and body
 */
function getCommits(cwd: string, artifactId: string, artifactPath?: string): CommitInfo[] {
  try {
    // Get the last tag for this specific artifact
    // Convention: artifactId@version (e.g., @grekt/cli-experts@1.0.0)
    const tagPattern = `${artifactId}@*`;
    let lastTag = "";

    try {
      lastTag = execSync(
        `git describe --tags --abbrev=0 --match "${tagPattern}" 2>/dev/null`,
        { cwd, encoding: "utf-8" }
      ).trim();
    } catch {
      // No tags for this artifact yet - get all commits
    }

    // Build range: from tag to HEAD, or all commits if no tag
    const range = lastTag ? `${lastTag}..HEAD` : "";

    // Use %x00 as delimiter between commits, %x01 between subject and body
    const delimiter = "\x00";
    const separator = "\x01";
    const format = `%s${separator}%b${delimiter}`;

    // Build git log command
    let cmd = `git log ${range} --pretty=format:"${format}"`;

    // Filter by path for multi-artifact repos
    if (artifactPath) {
      cmd += ` -- "${artifactPath}"`;
    }

    const output = execSync(cmd, { cwd, encoding: "utf-8" });

    if (!output.trim()) return [];

    return output
      .split(delimiter)
      .filter(entry => entry.trim())
      .map(entry => {
        const [subject, ...bodyParts] = entry.split(separator);
        return {
          subject: subject?.trim() || "",
          body: bodyParts.join(separator).trim(),
        };
      })
      .filter(c => c.subject.length > 0);
  } catch {
    return [];
  }
}

export class ConventionalCommitsCalculator implements VersionCalculator {
  async calculate(
    artifactPaths: string[],
    manifests: Map<string, { name: string; version: string }>,
    _options: CalculateOptions = {}
  ): Promise<VersionResult[]> {
    const results: VersionResult[] = [];
    const cwd = process.cwd();
    const isMonorepo = artifactPaths.length > 1;

    for (const artifactPath of artifactPaths) {
      const manifest = manifests.get(artifactPath);
      if (!manifest) continue;

      // Get commits for this artifact
      const commits = getCommits(
        cwd,
        manifest.name,
        isMonorepo ? artifactPath : undefined
      );

      // Parse conventional commits
      const parsedCommits = commits
        .map(parseCommit)
        .filter((c): c is ParsedCommit => c !== null);

      // Filter out ignored types for bump calculation
      const relevantCommits = parsedCommits.filter(
        c => !IGNORED_TYPES.includes(c.type) || c.breaking
      );

      // Determine bump type
      const bump = determineBumpType(relevantCommits);

      // Calculate new version
      const newVersion = bump ? bumpVersion(manifest.version, bump) : null;

      results.push({
        artifactPath,
        artifactId: manifest.name,
        previousVersion: manifest.version,
        newVersion,
        releaseType: bump,
        commits: relevantCommits.length,
      });
    }

    return results;
  }
}

/**
 * Create the default version calculator.
 */
export function createVersionCalculator(): VersionCalculator {
  return new ConventionalCommitsCalculator();
}
