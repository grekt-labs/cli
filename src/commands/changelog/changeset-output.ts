import { join } from "path";
import { randomBytes } from "crypto";
import { stringify as stringifyYaml } from "yaml";
import { fs } from "#/context";
import type { ArtifactChangelog } from "./changelog.types";

const CHANGESET_DIR = ".changeset";

/**
 * Generate one .changeset/*.md file per artifact.
 * Each file contains isolated frontmatter + body to prevent cross-contamination.
 * Returns the list of file paths written.
 */
export function generateChangesetFiles(
  artifacts: ArtifactChangelog[],
  workspaceRoot: string,
): string[] {
  const changesetDir = join(workspaceRoot, CHANGESET_DIR);

  if (!fs.exists(changesetDir)) {
    fs.mkdir(changesetDir, { recursive: true });
  }

  const paths: string[] = [];

  for (const artifact of artifacts) {
    const filename = `${randomBytes(4).toString("hex")}.md`;
    const filepath = join(changesetDir, filename);
    const content = buildChangesetContent([artifact]);

    fs.writeFile(filepath, content);
    paths.push(filepath);
  }

  return paths;
}

/**
 * Build changeset file content (YAML frontmatter + commit summary).
 */
function buildChangesetContent(artifacts: ArtifactChangelog[]): string {
  const frontmatterLines: string[] = [];
  const bodyLines: string[] = [];

  for (const entry of artifacts) {
    const { name } = entry.artifact.manifest;

    frontmatterLines.push(`"${name}": ${entry.calculatedBump}`);

    if (entry.commits.length > 0) {
      for (const commit of entry.commits) {
        bodyLines.push(`- ${name}: ${commit.type}: ${commit.message}`);
      }
    } else {
      bodyLines.push(`- ${name}: changed files detected`);
    }
  }

  return ["---", ...frontmatterLines, "---", "", ...bodyLines, ""].join("\n");
}

/**
 * Build changeset content string for dry-run preview.
 */
export function previewChangesetContent(
  artifacts: ArtifactChangelog[],
): string {
  return buildChangesetContent(artifacts);
}

function toOutputEntry(entry: ArtifactChangelog) {
  return {
    name: entry.artifact.manifest.name,
    version: entry.artifact.manifest.version,
    bump: entry.calculatedBump,
    commits: entry.commits.map((commit) => ({
      hash: commit.hash,
      type: commit.type,
      scope: commit.scope,
      breaking: commit.breaking,
      message: commit.message,
    })),
    changedFiles: entry.changedFiles,
  };
}

/**
 * Format artifact changelogs as JSON.
 */
export function formatJson(
  artifacts: ArtifactChangelog[],
  baseRef: string,
): string {
  return JSON.stringify(
    { baseRef, artifacts: artifacts.map(toOutputEntry) },
    null,
    2,
  );
}

/**
 * Format artifact changelogs as YAML.
 */
export function formatYaml(
  artifacts: ArtifactChangelog[],
  baseRef: string,
): string {
  return stringifyYaml({
    baseRef,
    artifacts: artifacts.map(toOutputEntry),
  });
}
