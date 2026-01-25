import { Command } from "commander";
import { existsSync, rmSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { confirm } from "@inquirer/prompts";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getLockfile, saveLockfile } from "#/context";
import { getSafeFilename } from "@grekt-labs/cli-engine";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { success, error, info, log, newline, colors } from "#/shared/ui/ui";

// Claude target paths
const CLAUDE_DIR = ".claude";
const CLAUDE_AGENTS_DIR = join(CLAUDE_DIR, "agents");
const CLAUDE_SKILLS_DIR = join(CLAUDE_DIR, "skills");
const CLAUDE_COMMANDS_DIR = join(CLAUDE_DIR, "commands");

export const removeCommand = new Command("remove")
  .alias("rm")
  .description("Remove an installed artifact")
  .argument("<artifact>", "Artifact ID to remove (e.g., @grekt/code-reviewer)")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (artifactId: string, options: { force?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const config = getConfig(projectRoot);
    const lockfile = getLockfile(projectRoot);

    // Check if artifact is installed
    if (!lockfile.artifacts[artifactId]) {
      error(`Artifact ${colors.highlight(artifactId)} is not installed`);
      newline();
      info("Run 'grekt list' to see installed artifacts");
      process.exit(1);
    }

    const artifact = lockfile.artifacts[artifactId];
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

    // Show what will be removed
    log(colors.bold("Will remove:"));
    newline();
    log(`  ${colors.highlight(artifactId)}@${colors.dim(artifact.version)}`);

    if (artifact.agent) {
      log(`    ${colors.dim("agent:")} ${artifact.agent}`);
    }
    if (artifact.skills.length > 0) {
      log(`    ${colors.dim("skills:")} ${artifact.skills.join(", ")}`);
    }
    if (artifact.commands.length > 0) {
      log(`    ${colors.dim("commands:")} ${artifact.commands.join(", ")}`);
    }

    newline();

    // Confirm unless --force
    if (!options.force) {
      const confirmed = await confirm({
        message: "Remove this artifact?",
        default: false,
      });

      if (!confirmed) {
        info("Cancelled");
        process.exit(0);
      }
    }

    const removed: string[] = [];

    // Remove from .grekt/artifacts/
    if (existsSync(artifactDir)) {
      rmSync(artifactDir, { recursive: true, force: true });
      removed.push(`${ARTIFACTS_DIR}/${artifactId}`);
    }

    // Remove synced files from .claude/
    const claudeDir = `${projectRoot}/${CLAUDE_DIR}`;
    if (existsSync(claudeDir)) {
      // Remove agent file
      if (artifact.agent) {
        const agentTarget = `${projectRoot}/${CLAUDE_AGENTS_DIR}/${artifactId.replace("/", "-")}.md`;
        if (existsSync(agentTarget)) {
          unlinkSync(agentTarget);
          removed.push(`${CLAUDE_AGENTS_DIR}/${artifactId.replace("/", "-")}.md`);
        }
      }

      // Remove skill files (namespaced)
      for (const skillPath of artifact.skills) {
        const skillName = getSafeFilename(artifactId, skillPath);
        const skillTarget = `${projectRoot}/${CLAUDE_SKILLS_DIR}/${skillName}`;
        if (existsSync(skillTarget)) {
          unlinkSync(skillTarget);
          removed.push(`${CLAUDE_SKILLS_DIR}/${skillName}`);
        }
      }

      // Remove command files (namespaced)
      for (const cmdPath of artifact.commands) {
        const cmdName = getSafeFilename(artifactId, cmdPath);
        const cmdTarget = `${projectRoot}/${CLAUDE_COMMANDS_DIR}/${cmdName}`;
        if (existsSync(cmdTarget)) {
          unlinkSync(cmdTarget);
          removed.push(`${CLAUDE_COMMANDS_DIR}/${cmdName}`);
        }
      }

      // Clean up empty directories
      cleanEmptyDir(`${projectRoot}/${CLAUDE_AGENTS_DIR}`);
      cleanEmptyDir(`${projectRoot}/${CLAUDE_SKILLS_DIR}`);
      cleanEmptyDir(`${projectRoot}/${CLAUDE_COMMANDS_DIR}`);
    }

    // Update grekt.yaml
    delete config.artifacts[artifactId];
    saveConfig(config, projectRoot);

    // Update lockfile
    delete lockfile.artifacts[artifactId];
    saveLockfile(lockfile, projectRoot);

    newline();
    success(`Removed ${colors.highlight(artifactId)}`);

    if (removed.length > 0) {
      log(colors.dim(`  Cleaned: ${removed.length} files/directories`));
    }

    newline();
    info("Run 'grekt sync' to update CLAUDE.md");
  });

/**
 * Remove directory if empty
 */
function cleanEmptyDir(dir: string): void {
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    if (files.length === 0) {
      rmSync(dir, { recursive: true });
    }
  }
}
