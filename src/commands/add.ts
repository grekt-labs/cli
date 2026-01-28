import { Command } from "commander";
import { existsSync, mkdirSync, rmSync, renameSync } from "fs";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getLockfile, saveLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource } from "#/registry/sources/sources";
import { getSourceDisplayName } from "#/registry/registry";
import { scanArtifact, getArtifactId } from "#/context";
import { hashDirectory, calculateIntegrity } from "#/context";
import { selectComponents, isEmptySelection, isFullSelection } from "#/artifact/selector/selector";
import { removeUnselectedFiles } from "#/artifact/component-manager/component-manager";
import { runCheck, displayCompactCheckResults } from "#/artifact/check/check";
import { success, error, info, log, warning, newline, colors, spinner } from "#/shared/ui/ui";
import { compareSemver } from "@grekt-labs/cli-engine";


export const addCommand = new Command("add")
  .description("Add an artifact from registry, GitHub, or GitLab")
  .argument("<source>", "Artifact source (e.g., @grekt/code-reviewer, github:user/repo, gitlab:host/user/repo)")
  .option("-c, --choose", "Choose which components to install")
  .option("--core", "Mark artifact as CORE (copied to target on sync, not just indexed)")
  .action(async (sourceArg: string, options: { choose?: boolean; core?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    // Parse the source
    const source = parseSource(sourceArg);
    const displayName = getSourceDisplayName(source);

    // For git sources, use temp dir first, then rename after we know the artifact ID
    const tempDir = `${projectRoot}/${ARTIFACTS_DIR}/.tmp-${Date.now()}`;

    const spin = spinner(`Downloading ${displayName}...`);
    spin.start();

    // Download artifact from source
    mkdirSync(tempDir, { recursive: true });
    const downloadResult = await downloadFromSource(source, tempDir, projectRoot);

    spin.stop();

    // Handle deprecation warning for registry sources
    if (downloadResult.deprecationMessage) {
      warning(`This version is deprecated: ${downloadResult.deprecationMessage}`);
      newline();
    }

    if (!downloadResult.success) {
      // Clean up temp directory
      rmSync(tempDir, { recursive: true, force: true });
      error(`Artifact ${colors.highlight(displayName)} not found`);
      if (source.type === "registry") {
        info("Check .grekt/config.yaml for custom registry configuration");
      } else if (source.type === "github") {
        info("Check the repository exists and you have access");
        info("For private repos, set GITHUB_TOKEN environment variable");
      } else if (source.type === "gitlab") {
        info("Check the repository exists and you have access");
        info("For private repos, set GITLAB_TOKEN environment variable");
      }
      process.exit(1);
    }

    // Scan the downloaded artifact
    const artifactInfo = scanArtifact(tempDir);

    if (!artifactInfo) {
      rmSync(tempDir, { recursive: true, force: true });
      error("Invalid artifact: missing grekt.yaml or invalid structure");
      process.exit(1);
    }

    const resolvedArtifactId = getArtifactId(artifactInfo.manifest.author, artifactInfo.manifest.name);

    // Now we know the artifact ID, create final target directory
    const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${resolvedArtifactId}`;

    // Check if already installed - update if newer version, skip if same/older
    const lockfile = getLockfile(projectRoot);
    if (existsSync(targetDir)) {
      const existing = lockfile.artifacts[resolvedArtifactId];
      const newVersion = artifactInfo.manifest.version;

      if (existing) {
        try {
          const comparison = compareSemver(newVersion, existing.version);
          if (comparison <= 0) {
            rmSync(tempDir, { recursive: true, force: true });
            info(`Already installed: ${colors.highlight(resolvedArtifactId)}@${existing.version}`);
            if (comparison < 0) {
              info(`Current version (${existing.version}) is newer than requested (${newVersion})`);
            }
            process.exit(0);
          }
          // New version is higher - proceed with update
          log(`Updating ${colors.highlight(resolvedArtifactId)}: ${existing.version} → ${newVersion}`);
        } catch {
          // If comparison fails (invalid semver), proceed with replacement
        }
      }

      // Remove old version to replace with new
      rmSync(targetDir, { recursive: true, force: true });
    }

    // Ensure parent directory exists (for scoped artifacts like @scope/name)
    const parentDir = targetDir.substring(0, targetDir.lastIndexOf("/"));
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Move temp dir to final location
    renameSync(tempDir, targetDir);

    // Determine which components to install
    let selectedAgent = artifactInfo.agent?.path;
    let selectedSkills = artifactInfo.skills.map((s) => s.path);
    let selectedCommands = artifactInfo.commands.map((c) => c.path);

    // If --choose flag, let user select components
    if (options.choose) {
      const hasComponents = artifactInfo.agent || artifactInfo.skills.length > 0 || artifactInfo.commands.length > 0;

      if (hasComponents) {
        newline();
        log(`${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}`);
        newline();

        const selection = await selectComponents(artifactInfo);
        selectedAgent = selection.agent;
        selectedSkills = selection.skills;
        selectedCommands = selection.commands;

        if (isEmptySelection(selection)) {
          warning("No components selected");
          rmSync(targetDir, { recursive: true, force: true });
          process.exit(0);
        }

        // Remove unselected files from artifact directory
        removeUnselectedFiles(targetDir, artifactInfo, {
          agent: selectedAgent,
          skills: selectedSkills,
          commands: selectedCommands,
        });
      }
    }

    // Update grekt.yaml with artifact info
    const config = getConfig(projectRoot);

    // Check if all components were selected (no --choose or all selected)
    const currentSelection = { agent: selectedAgent, skills: selectedSkills, commands: selectedCommands };
    const allSelected = isFullSelection(artifactInfo, currentSelection);

    // Use simple format only if all selected AND not core mode
    if (allSelected && !options.core) {
      // Simple format: just version (LAZY mode by default)
      config.artifacts[resolvedArtifactId] = artifactInfo.manifest.version;
    } else {
      // Detailed format: version + mode + selected components
      const entry: Record<string, unknown> = {
        version: artifactInfo.manifest.version,
      };
      if (options.core) entry.mode = "core";
      if (selectedAgent) entry.agent = true;
      if (selectedSkills.length > 0) entry.skills = selectedSkills;
      if (selectedCommands.length > 0) entry.commands = selectedCommands;
      config.artifacts[resolvedArtifactId] = entry as typeof config.artifacts[string];
    }
    saveConfig(config, projectRoot);

    // Calculate checksums for all files
    const fileHashes = hashDirectory(targetDir);
    const integrity = calculateIntegrity(fileHashes);

    // Update lockfile with version, checksums, and selected component paths
    lockfile.artifacts[resolvedArtifactId] = {
      version: artifactInfo.manifest.version,
      integrity,
      source: source.raw,
      resolved: downloadResult.resolved, // Full URL, immutable after write
      files: fileHashes,
      agent: selectedAgent,
      skills: selectedSkills,
      commands: selectedCommands,
    };
    saveLockfile(lockfile, projectRoot);

    newline();
    const modeLabel = options.core ? ` ${colors.dim("(core)")}` : "";
    success(`Installed ${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}${modeLabel}`);

    // Show what was actually installed
    if (selectedAgent) {
      const agentName = artifactInfo.agent?.parsed.frontmatter["grk-name"] ?? selectedAgent;
      log(`  ${colors.dim("agent:")} ${agentName}`);
    }
    if (selectedSkills.length > 0) {
      const skillNames = selectedSkills.map((path) => {
        const skill = artifactInfo.skills.find((s) => s.path === path);
        return skill?.parsed.frontmatter["grk-name"] ?? path;
      });
      log(`  ${colors.dim("skills:")} ${skillNames.join(", ")}`);
    }
    if (selectedCommands.length > 0) {
      const cmdNames = selectedCommands.map((path) => {
        const cmd = artifactInfo.commands.find((c) => c.path === path);
        return cmd?.parsed.frontmatter["grk-name"] ?? path;
      });
      log(`  ${colors.dim("commands:")} ${cmdNames.join(", ")}`);
    }

    newline();
    info("Run 'grekt sync' to sync with your AI tools");

    if (config.options.autoCheck) {
      const summary = runCheck(projectRoot);
      displayCompactCheckResults(summary);
    }
  });
