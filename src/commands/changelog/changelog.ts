import { Command } from "commander";
import { select, confirm } from "@inquirer/prompts";
import type { BumpType } from "@grekt-labs/cli-engine";
import { isWorkspaceRoot } from "@grekt-labs/cli-engine";
import { fs } from "#/context";
import { loadWorkspace } from "#/workspace/workspace";
import { withPromptHandler } from "#/shared/prompts/prompts";
import {
  success,
  error,
  warning,
  info,
  log,
  newline,
  colors,
  symbols,
} from "#/shared/ui/ui";
import {
  detectBaseRef,
  detectArtifactBaseRef,
  getChangedFiles,
  getCommitsForPath,
} from "./git";
import {
  parseConventionalCommit,
  determineBumpType,
  mapFilesToArtifacts,
} from "./conventional-commits";
import {
  generateChangesetFile,
  previewChangesetContent,
  formatJson,
  formatYaml,
} from "./changeset-output";
import type { ArtifactChangelog, ChangelogOptions } from "./changelog.types";

const BUMP_CHOICES: Array<{ name: string; value: BumpType | "skip" }> = [
  { name: "patch", value: "patch" },
  { name: "minor", value: "minor" },
  { name: "major", value: "major" },
  { name: "skip", value: "skip" },
];

export const changelogCommand = new Command("changelog")
  .description(
    "Generate changesets from git history for workspace artifacts",
  )
  .option("--ci", "Unattended mode (no prompts, auto-generate from commits)")
  .option(
    "--format <format>",
    "Output format: changeset (default), json, yaml",
    "changeset",
  )
  .option("--since <ref>", "Override base ref (auto-detected otherwise)")
  .option("--dry-run", "Preview without writing")
  .action(async (options: ChangelogOptions) => {
    const cwd = process.cwd();

    if (!isWorkspaceRoot(fs, cwd)) {
      error("Not a workspace (grekt-workspace.yaml not found)");
      info("Run this command from your workspace root");
      process.exit(1);
    }

    const workspace = await loadWorkspace(cwd);
    if (!workspace || workspace.artifacts.length === 0) {
      error("No artifacts found in workspace");
      process.exit(1);
    }

    const globalBaseRef = detectBaseRef(options.since);

    const artifactChangelogs = globalBaseRef
      ? buildFromGlobalRef(workspace.artifacts, globalBaseRef, options.ci)
      : buildPerArtifact(workspace.artifacts, options.ci);

    if (artifactChangelogs.length === 0) {
      info("No artifact changes detected");
      process.exit(0);
    }

    const displayRef = globalBaseRef ?? "per-artifact tags";

    if (options.ci) {
      printSummary(artifactChangelogs, displayRef);
      outputResult(artifactChangelogs, displayRef, cwd, options);
    } else {
      await withPromptHandler(() =>
        handleInteractiveMode(artifactChangelogs, displayRef, cwd, options),
      );
    }
  });

/**
 * Build changelogs using a single global base ref (feature branch or --since).
 * Uses git diff to find which artifacts have changed files.
 */
function buildFromGlobalRef(
  artifacts: ReadonlyArray<{ relativePath: string; manifest: { name: string } }>,
  baseRef: string,
  ciMode?: boolean,
): ArtifactChangelog[] {
  const changedFiles = getChangedFiles(baseRef);
  if (changedFiles.length === 0) return [];

  const filesByArtifact = mapFilesToArtifacts(changedFiles, artifacts);
  const result: ArtifactChangelog[] = [];

  for (const artifact of artifacts) {
    const files = filesByArtifact.get(artifact.relativePath);
    if (!files) continue;

    result.push(
      buildArtifactChangelog(artifact, files, baseRef, ciMode),
    );
  }

  return result;
}

/**
 * Build changelogs per artifact on the default branch.
 * Each artifact resolves its own base ref from its tags.
 * Artifacts without tags are treated as new (all commits are relevant).
 */
function buildPerArtifact(
  artifacts: ReadonlyArray<{ relativePath: string; manifest: { name: string } }>,
  ciMode?: boolean,
): ArtifactChangelog[] {
  const result: ArtifactChangelog[] = [];

  for (const artifact of artifacts) {
    const baseRef = detectArtifactBaseRef(artifact.manifest.name);
    const changedFiles = getChangedFiles(baseRef, artifact.relativePath);

    if (changedFiles.length === 0) continue;

    result.push(
      buildArtifactChangelog(artifact, changedFiles, baseRef, ciMode),
    );
  }

  return result;
}

/**
 * Build changelog entry for a single artifact.
 */
function buildArtifactChangelog(
  artifact: { relativePath: string; manifest: { name: string } },
  changedFiles: string[],
  baseRef: string,
  ciMode?: boolean,
): ArtifactChangelog {
  const commitLines = getCommitsForPath(baseRef, artifact.relativePath);
  const commits = commitLines
    .map(parseConventionalCommit)
    .filter((commit) => commit !== null);

  const nonConventionalCount = commitLines.length - commits.length;

  if (nonConventionalCount > 0 && ciMode) {
    warning(
      `${artifact.manifest.name}: ${nonConventionalCount} non-conventional commit(s) ignored`,
    );
  }

  const calculatedBump =
    commits.length > 0 ? determineBumpType(commits) : "patch";

  if (commits.length === 0 && ciMode) {
    warning(
      `${artifact.manifest.name}: no conventional commits found, defaulting to patch`,
    );
  }

  return {
    artifact: artifact as ArtifactChangelog["artifact"],
    commits,
    calculatedBump,
    changedFiles,
  };
}

function printSummary(
  artifactChangelogs: ArtifactChangelog[],
  baseRef: string,
): void {
  newline();
  info(`Base ref: ${colors.highlight(baseRef)}`);
  info(`${artifactChangelogs.length} artifact(s) with changes:`);
  newline();

  for (const entry of artifactChangelogs) {
    const { name, version } = entry.artifact.manifest;
    log(
      `  ${name} ${colors.dim(`v${version}`)} ${symbols.arrow} ${colors.bold(entry.calculatedBump)} ${colors.dim(`(${entry.commits.length} commit(s))`)}`,
    );
  }

  newline();
}

async function handleInteractiveMode(
  artifactChangelogs: ArtifactChangelog[],
  baseRef: string,
  cwd: string,
  options: ChangelogOptions,
): Promise<void> {
  printSummary(artifactChangelogs, baseRef);

  const finalChangelogs: ArtifactChangelog[] = [];

  for (const entry of artifactChangelogs) {
    const { name } = entry.artifact.manifest;

    const bump = await select({
      message: `${name}: bump type?`,
      choices: BUMP_CHOICES,
      default: entry.calculatedBump,
    });

    if (bump === "skip") {
      info(`Skipping ${name}`);
      continue;
    }

    finalChangelogs.push({
      ...entry,
      calculatedBump: bump,
    });
  }

  if (finalChangelogs.length === 0) {
    newline();
    info("All artifacts skipped");
    return;
  }

  newline();

  const confirmed = await confirm({
    message: `Generate changeset for ${finalChangelogs.length} artifact(s)?`,
    default: true,
  });

  if (!confirmed) {
    info("Cancelled");
    return;
  }

  outputResult(finalChangelogs, baseRef, cwd, options);
}

function outputResult(
  artifactChangelogs: ArtifactChangelog[],
  baseRef: string,
  cwd: string,
  options: ChangelogOptions,
): void {
  const format = options.format ?? "changeset";

  if (format === "json") {
    log(formatJson(artifactChangelogs, baseRef));
    return;
  }

  if (format === "yaml") {
    log(formatYaml(artifactChangelogs, baseRef));
    return;
  }

  if (options.dryRun) {
    newline();
    info("Dry run — changeset content:");
    newline();
    log(previewChangesetContent(artifactChangelogs));
    return;
  }

  const filepath = generateChangesetFile(artifactChangelogs, cwd);
  newline();
  success(`Changeset written to ${filepath}`);
}
