import { Command } from "commander";
import { existsSync, mkdirSync, rmSync, unlinkSync, readdirSync, renameSync } from "fs";
import { join } from "path";
import { checkbox } from "@inquirer/prompts";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getLockfile, saveLockfile } from "#/artifact/lockfile/lockfile";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource, getSourceDisplayName } from "#/registry/sources/sources";
import { scanArtifact, getArtifactId, type ArtifactInfo } from "#/artifact/scanner/scanner";
import { hashDirectory, calculateIntegrity, getDirectorySize, formatBytes, estimateTokens } from "#/artifact/integrity/integrity";
import { runCheck, displayCompactCheckResults } from "#/artifact/check/check";
import { success, error, info, log, warning, newline, colors, spinner } from "#/shared/ui/ui";

const CONTEXT_WARNING_THRESHOLD = 10 * 1024; // 10 KB

interface ComponentSelection {
  agent: string | undefined;
  skills: string[];
  commands: string[];
}

async function selectComponents(artifactInfo: ArtifactInfo): Promise<ComponentSelection> {
  const choices: Array<{ name: string; value: { type: string; path: string }; checked: boolean }> = [];

  if (artifactInfo.agent) {
    choices.push({
      name: `agent: ${artifactInfo.agent.parsed.frontmatter.name}`,
      value: { type: "agent", path: artifactInfo.agent.path },
      checked: true,
    });
  }

  for (const skill of artifactInfo.skills) {
    choices.push({
      name: `skill: ${skill.parsed.frontmatter.name}`,
      value: { type: "skill", path: skill.path },
      checked: true,
    });
  }

  for (const cmd of artifactInfo.commands) {
    choices.push({
      name: `command: ${cmd.parsed.frontmatter.name}`,
      value: { type: "command", path: cmd.path },
      checked: true,
    });
  }

  const selected = await checkbox({
    message: "Select components to install:",
    choices,
  });

  const result: ComponentSelection = {
    agent: undefined,
    skills: [],
    commands: [],
  };

  for (const item of selected) {
    if (item.type === "agent") {
      result.agent = item.path;
    } else if (item.type === "skill") {
      result.skills.push(item.path);
    } else if (item.type === "command") {
      result.commands.push(item.path);
    }
  }

  return result;
}

/**
 * Remove unselected component files from artifact directory
 */
function removeUnselectedFiles(
  artifactDir: string,
  artifactInfo: ArtifactInfo,
  selection: ComponentSelection
): void {
  // Remove unselected agent
  if (artifactInfo.agent && !selection.agent) {
    const agentPath = join(artifactDir, artifactInfo.agent.path);
    if (existsSync(agentPath)) {
      unlinkSync(agentPath);
    }
  }

  // Remove unselected skills
  for (const skill of artifactInfo.skills) {
    if (!selection.skills.includes(skill.path)) {
      const skillPath = join(artifactDir, skill.path);
      if (existsSync(skillPath)) {
        unlinkSync(skillPath);
      }
    }
  }

  // Remove unselected commands
  for (const cmd of artifactInfo.commands) {
    if (!selection.commands.includes(cmd.path)) {
      const cmdPath = join(artifactDir, cmd.path);
      if (existsSync(cmdPath)) {
        unlinkSync(cmdPath);
      }
    }
  }

  // Clean up empty directories
  cleanEmptyDirs(artifactDir);
}

/**
 * Recursively remove empty directories
 */
function cleanEmptyDirs(dir: string): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subdir = join(dir, entry.name);
      cleanEmptyDirs(subdir);

      // Check if directory is now empty
      const remaining = readdirSync(subdir);
      if (remaining.length === 0) {
        rmSync(subdir);
      }
    }
  }
}

export const addCommand = new Command("add")
  .description("Add an artifact from registry, GitHub, or GitLab")
  .argument("<source>", "Artifact source (e.g., @grekt/code-reviewer, github:user/repo, gitlab:host/user/repo)")
  .option("-c, --choose", "Choose which components to install")
  .action(async (sourceArg: string, options: { choose?: boolean }) => {
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

    // Check if already installed
    if (existsSync(targetDir)) {
      rmSync(tempDir, { recursive: true, force: true });
      warning(`Artifact ${colors.highlight(resolvedArtifactId)} is already installed`);
      info("Use 'grekt remove' first to reinstall");
      process.exit(1);
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

        if (!selectedAgent && selectedSkills.length === 0 && selectedCommands.length === 0) {
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
    const allAgent = artifactInfo.agent ? selectedAgent === artifactInfo.agent.path : true;
    const allSkills = selectedSkills.length === artifactInfo.skills.length;
    const allCommands = selectedCommands.length === artifactInfo.commands.length;
    const allSelected = allAgent && allSkills && allCommands;

    if (allSelected) {
      // Simple format: just version
      config.artifacts[resolvedArtifactId] = artifactInfo.manifest.version;
    } else {
      // Detailed format: version + selected components
      config.artifacts[resolvedArtifactId] = {
        version: artifactInfo.manifest.version,
        agent: selectedAgent ? true : undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        commands: selectedCommands.length > 0 ? selectedCommands : undefined,
      };
    }
    saveConfig(config, projectRoot);

    // Calculate checksums for all files
    const fileHashes = hashDirectory(targetDir);
    const integrity = calculateIntegrity(fileHashes);

    // Update lockfile with version, checksums, and selected component paths
    const lockfile = getLockfile(projectRoot);
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

    // Check artifact size and warn if large
    const artifactSize = getDirectorySize(targetDir);
    if (artifactSize > CONTEXT_WARNING_THRESHOLD) {
      newline();
      warning(`Artifact is ${formatBytes(artifactSize)} (~${estimateTokens(artifactSize).toLocaleString()} tokens)`);
      info("Large artifacts may impact AI context. Consider if all content is necessary.");
    }

    newline();
    success(`Installed ${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}`);

    // Show what was actually installed
    if (selectedAgent) {
      const agentName = artifactInfo.agent?.parsed.frontmatter.name ?? selectedAgent;
      log(`  ${colors.dim("agent:")} ${agentName}`);
    }
    if (selectedSkills.length > 0) {
      const skillNames = selectedSkills.map((path) => {
        const skill = artifactInfo.skills.find((s) => s.path === path);
        return skill?.parsed.frontmatter.name ?? path;
      });
      log(`  ${colors.dim("skills:")} ${skillNames.join(", ")}`);
    }
    if (selectedCommands.length > 0) {
      const cmdNames = selectedCommands.map((path) => {
        const cmd = artifactInfo.commands.find((c) => c.path === path);
        return cmd?.parsed.frontmatter.name ?? path;
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
