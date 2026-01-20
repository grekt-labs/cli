import { Command } from "commander";
import { existsSync, mkdirSync, rmSync } from "fs";
import { isInitialized } from "#/lib/config";
import { getInstalled, saveInstalled } from "#/lib/installed";
import { getLockfile, saveLockfile } from "#/lib/lockfile";
import { GREKTS_DIR } from "#/lib/paths";
import { isRegistryConfigured, getRegistryUrl, downloadFromRegistry } from "#/lib/registry";
import { scanArtifact, getArtifactId } from "#/lib/artifact";
import { hashDirectory, calculateIntegrity, getDirectorySize, formatBytes, estimateTokens } from "#/lib/integrity";
import { success, error, info, log, warning, newline, colors, spinner } from "#/utils/ui";

const CONTEXT_WARNING_THRESHOLD = 10 * 1024; // 10 KB

export const addCommand = new Command("add")
  .description("Add an artifact from the registry")
  .argument("<artifact>", "Artifact ID (e.g., @grekt/code-reviewer)")
  .action(async (artifactId: string) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    if (!isRegistryConfigured()) {
      error("Registry not configured");
      newline();
      info("Set REGISTRY_URL in your .env file");
      info("Example: REGISTRY_URL=https://your-registry.example.com");
      process.exit(1);
    }

    const targetDir = `${projectRoot}/${GREKTS_DIR}/${artifactId}`;

    // Check if already installed
    if (existsSync(targetDir)) {
      error(`Artifact ${colors.highlight(artifactId)} is already installed`);
      info("Run 'grekt remove' first to reinstall");
      process.exit(1);
    }

    const spin = spinner(`Downloading ${artifactId}...`);
    spin.start();

    // Download artifact from registry
    mkdirSync(targetDir, { recursive: true });
    const downloaded = await downloadFromRegistry(artifactId, targetDir);

    spin.stop();

    if (!downloaded) {
      // Clean up empty directory
      rmSync(targetDir, { recursive: true, force: true });
      error(`Artifact ${colors.highlight(artifactId)} not found in registry`);
      info(`Registry: ${getRegistryUrl()}`);
      process.exit(1);
    }

    // Scan the downloaded artifact
    const artifactInfo = scanArtifact(targetDir);

    if (!artifactInfo) {
      error("Invalid artifact: missing grekt.yaml or invalid structure");
      process.exit(1);
    }

    const resolvedArtifactId = getArtifactId(artifactInfo.manifest.author, artifactInfo.manifest.name);

    // Update installed.yaml
    const installed = getInstalled(projectRoot);
    installed.artifacts[resolvedArtifactId] = {
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
    lockfile.artifacts[resolvedArtifactId] = {
      version: artifactInfo.manifest.version,
      integrity,
      source: `registry:${artifactId}`,
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
    success(`Installed ${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}`);

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
