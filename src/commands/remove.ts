import { Command } from "commander";
import { existsSync, rmSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { confirm } from "@inquirer/prompts";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getLockfile, saveLockfile } from "#/context";
import { getSafeFilename, CATEGORIES, CATEGORY_CONFIG, isUniqueCategory, type Category } from "@grekt-labs/cli-engine";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { generateArtifactIndex } from "#/artifact/index/index";
import { success, error, info, log, newline, colors } from "#/shared/ui/ui";
import { withPromptHandler } from "#/shared/prompts/prompts";

// Claude target paths (TODO: should use sync manager for all targets)
const CLAUDE_DIR = ".claude";
const CLAUDE_CATEGORY_DIRS: Record<Category, string> = {
  agents: join(CLAUDE_DIR, "agents"),
  skills: join(CLAUDE_DIR, "skills"),
  commands: join(CLAUDE_DIR, "commands"),
  mcps: join(CLAUDE_DIR, "mcps"),
  rules: join(CLAUDE_DIR, "rules"),
};

export const removeCommand = new Command("remove")
  .alias("rm")
  .description("Remove an installed artifact")
  .argument("<artifact>", "Artifact ID to remove (e.g., @grekt/code-reviewer)")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (artifactId: string, options: { force?: boolean }) => {
    await withPromptHandler(async () => {
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

    for (const category of CATEGORIES) {
      const paths = artifact[category];
      if (paths && paths.length > 0) {
        log(`    ${colors.dim(`${category}:`)} ${paths.join(", ")}`);
      }
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
      for (const category of CATEGORIES) {
        const categoryDir = CLAUDE_CATEGORY_DIRS[category];
        const paths = artifact[category];

        if (!paths || paths.length === 0) continue;

        for (const filePath of paths) {
          // Unique categories use artifactId-based naming, others use getSafeFilename
          const targetName = isUniqueCategory(category)
            ? `${artifactId.replace("/", "-")}.md`
            : getSafeFilename(artifactId, filePath);

          const targetPath = `${projectRoot}/${categoryDir}/${targetName}`;
          if (existsSync(targetPath)) {
            unlinkSync(targetPath);
            removed.push(`${categoryDir}/${targetName}`);
          }
        }

        // Clean up empty directory
        cleanEmptyDir(`${projectRoot}/${categoryDir}`);
      }
    }

    // Update grekt.yaml
    delete config.artifacts[artifactId];
    saveConfig(config, projectRoot);

    // Update lockfile
    delete lockfile.artifacts[artifactId];
    saveLockfile(lockfile, projectRoot);

    // Regenerate artifact index
    generateArtifactIndex(projectRoot, config);

    newline();
    success(`Removed ${colors.highlight(artifactId)}`);

    if (removed.length > 0) {
      log(colors.dim(`  Cleaned: ${removed.length} files/directories`));
    }

    newline();
    info("Run 'grekt sync' to update CLAUDE.md");
    });
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
