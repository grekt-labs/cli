import { dirname } from "path";
import { Command } from "commander";
import { fs } from "#/context";
import { cleanEmptyDir } from "#/shared/filesystem/filesystem";
import { confirm } from "@inquirer/prompts";
import { getConfig, saveConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile, saveLockfile } from "#/context";
import { CATEGORIES, getCategoriesForFormat, type Category } from "@grekt-labs/cli-engine";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { generateArtifactIndex } from "#/artifact/index/index";
import { scanArtifact } from "#/context";
import { isSafeArtifactId } from "#/artifact/validation/validation";
import { success, error, info, log, newline, colors } from "#/shared/ui/ui";
import { withPromptHandler } from "#/shared/prompts/prompts";
import { getPlugin } from "#/sync/manager/manager";
import { uninstallHooks } from "#/sync/hooks";
import { getSafeFilename } from "@grekt-labs/cli-engine";

// Only MD categories are synced to target folders
const SYNCABLE_CATEGORIES = getCategoriesForFormat("md");

export const removeCommand = new Command("remove")
  .alias("rm")
  .description("Remove an installed artifact")
  .argument("[artifact]", "Artifact ID to remove (e.g., @grekt/code-reviewer)")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (artifactId: string | undefined, options: { force?: boolean }) => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      if (!artifactId) {
        error("Artifact ID required. Usage:");
        info("  grekt remove @scope/artifact");
        info("  grekt rm @scope/artifact");
        process.exit(1);
      }

      requireInitialized(projectRoot);

    // Validate artifact ID to prevent path traversal
    if (!isSafeArtifactId(artifactId)) {
      error("Invalid artifact ID: contains unsafe path characters");
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

    const lockfileEntry = lockfile.artifacts[artifactId];
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

    // Get component paths by scanning the artifact directory
    const artifactInfo = scanArtifact(artifactDir);
    const componentPaths: Record<Category, string[]> = {} as Record<Category, string[]>;
    for (const category of CATEGORIES) {
      componentPaths[category] = artifactInfo?.[category]?.map((f) => f.path) ?? [];
    }

    // Show what will be removed
    log(colors.bold("Will remove:"));
    newline();
    log(`  ${colors.highlight(artifactId)}@${colors.dim(lockfileEntry.version)}`);

    for (const category of CATEGORIES) {
      const paths = componentPaths[category];
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

    // Uninstall hooks from target tool settings before removing artifact
    const hooksRemoved = uninstallHooks(projectRoot, artifactId);
    if (hooksRemoved > 0) {
      removed.push(`${hooksRemoved} hook(s) from settings`);
    }

    // Remove from .grekt/artifacts/
    if (fs.exists(artifactDir)) {
      fs.rmdir(artifactDir, { recursive: true });
      removed.push(`${ARTIFACTS_DIR}/${artifactId}`);
    }

    // Remove synced files from all configured targets
    const allTargets = [...config.targets, ...Object.keys(config.customTargets ?? {})];

    for (const target of allTargets) {
      const plugin = getPlugin(target, config.customTargets);
      const syncPaths = plugin.getSyncPaths();

      // Skip targets that don't sync files (like cursor which only updates .cursorrules)
      if (!syncPaths) continue;

      for (const category of SYNCABLE_CATEGORIES) {
        const categoryDir = syncPaths[category];
        const paths = componentPaths[category];

        if (!paths || paths.length === 0) continue;

        for (const filePath of paths) {
          const targetName = plugin.resolveTargetPath
            ? plugin.resolveTargetPath(artifactId, category, filePath)
            : getSafeFilename(artifactId, filePath);
          const targetPath = `${projectRoot}/${categoryDir}/${targetName}`;

          if (fs.exists(targetPath)) {
            fs.unlink(targetPath);
            removed.push(`${categoryDir}/${targetName}`);

            // Clean up parent directory if target was inside a subfolder
            const targetDir = dirname(targetPath);
            const categoryFullPath = `${projectRoot}/${categoryDir}`;
            if (targetDir !== categoryFullPath) {
              cleanEmptyDir(targetDir);
            }
          }
        }

        // Clean up empty category directory
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

    if (allTargets.length > 0) {
      newline();
      info("Run 'grekt sync' to update context entry points");
    }
    });
  });

