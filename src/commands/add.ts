import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { isInitialized } from "#/lib/config";
import { getInstalled, saveInstalled } from "#/lib/installed";
import { getLockfile, saveLockfile } from "#/lib/lockfile";
import { GREKTS_DIR } from "#/lib/paths";
import { isGitHubSource, parseGitHubSource, downloadArtifact } from "#/lib/github";
import { scanArtifact, getArtifactId } from "#/lib/artifact";
import { hashDirectory, calculateIntegrity, getDirectorySize, formatBytes, estimateTokens } from "#/lib/integrity";
import { success, error, info, log, warning, newline, colors, spinner } from "#/utils/ui";

const CONTEXT_WARNING_THRESHOLD = 10 * 1024; // 10 KB

export const addCommand = new Command("add")
  .description("Add an artifact from GitHub")
  .argument("<source>", "GitHub URL (github:user/repo/@scope/name)")
  .action(async (source: string) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    if (!isGitHubSource(source)) {
      error("Only GitHub sources supported for now");
      newline();
      info("Examples:");
      log("  grekt add github:grekt/artifacts/@grekt/web-scraper");
      log("  grekt add https://github.com/grekt/artifacts/tree/main/@grekt/web-scraper");
      process.exit(1);
    }

    const ghSource = parseGitHubSource(source);
    if (!ghSource) {
      error("Invalid GitHub URL");
      newline();
      info("Format: github:user/repo/path/to/artifact");
      process.exit(1);
    }

    // Extract artifact name from path (last part like @scope/name)
    const pathParts = ghSource.path.split("/");
    let artifactName: string;

    // Check if path ends with @scope/name pattern
    if (pathParts.length >= 2 && pathParts[pathParts.length - 2]?.startsWith("@")) {
      artifactName = `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`;
    } else {
      artifactName = pathParts[pathParts.length - 1] || ghSource.path;
    }

    const targetDir = `${projectRoot}/${GREKTS_DIR}/${artifactName}`;

    // Check if already installed
    if (existsSync(targetDir)) {
      error(`Artifact ${colors.highlight(artifactName)} is already installed`);
      info("Run 'grekt remove' first to reinstall");
      process.exit(1);
    }

    const spin = spinner(`Downloading ${artifactName}...`);
    spin.start();

    // Download artifact from GitHub
    mkdirSync(targetDir, { recursive: true });
    const downloaded = await downloadArtifact(ghSource, targetDir);

    spin.stop();

    if (!downloaded) {
      error("Could not download artifact from GitHub");
      info(`Source: ${source}`);
      process.exit(1);
    }

    // Scan the downloaded artifact
    const artifactInfo = scanArtifact(targetDir);

    if (!artifactInfo) {
      error("Invalid artifact: missing grekt.yaml or invalid structure");
      process.exit(1);
    }

    const artifactId = getArtifactId(artifactInfo.manifest.author, artifactInfo.manifest.name);

    // Update installed.yaml
    const installed = getInstalled(projectRoot);
    installed.artifacts[artifactId] = {
      version: artifactInfo.manifest.version,
      agent: artifactInfo.agent?.path,
      skills: artifactInfo.skills.map((s) => s.path),
      commands: artifactInfo.commands.map((c) => c.path),
    };
    saveInstalled(installed, projectRoot);

    // Calculate checksums for all files
    const fileHashes = hashDirectory(targetDir);
    const integrity = calculateIntegrity(fileHashes);

    // Update lockfile with per-file hashes
    const lockfile = getLockfile(projectRoot);
    lockfile.artifacts[artifactId] = {
      version: artifactInfo.manifest.version,
      integrity,
      source: `github:${ghSource.owner}/${ghSource.repo}/${ghSource.path}`,
      files: fileHashes,
    };
    saveLockfile(lockfile, projectRoot);

    // Check artifact size and warn if large
    const artifactSize = getDirectorySize(targetDir);
    if (artifactSize > CONTEXT_WARNING_THRESHOLD) {
      newline();
      warning(`Artifact is ${formatBytes(artifactSize)} (~${estimateTokens(artifactSize).toLocaleString()} tokens)`);
      info("Large artifacts may impact AI context. Consider if all content is necessary.");
    }

    newline();
    success(`Installed ${colors.highlight(artifactId)}@${artifactInfo.manifest.version}`);

    if (artifactInfo.agent) {
      log(`  ${colors.dim("agent:")} ${artifactInfo.agent.parsed.frontmatter.name}`);
    }
    if (artifactInfo.skills.length > 0) {
      log(`  ${colors.dim("skills:")} ${artifactInfo.skills.map((s) => s.parsed.frontmatter.name).join(", ")}`);
    }
    if (artifactInfo.commands.length > 0) {
      log(`  ${colors.dim("commands:")} ${artifactInfo.commands.map((c) => c.parsed.frontmatter.name).join(", ")}`);
    }

    newline();
    info("Run 'grekt sync' to sync with your AI tools");
  });
