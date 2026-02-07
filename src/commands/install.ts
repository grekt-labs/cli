import { logger } from "#/shared/logger/logger";
import { Command } from "commander";
import { getConfig, getLocalConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile, lockfileExists, fs } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource, getSourceToken } from "#/registry/sources/sources";
import { downloadAndExtractTarball } from "#/registry/download/download";
import { verifyIntegrity } from "#/context";
import { generateArtifactIndex } from "#/artifact/index/index";
import { isSafeArtifactId } from "#/artifact/validation/validation";
import { resolveRegistry } from "#/registry/factory/factory";
import { parseArtifactId, getGitLabHeaders, getGitHubHeaders, scanArtifact } from "@grekt-labs/cli-engine";
import { success, error, info, warning, log, newline, colors, spinner } from "#/shared/ui/ui";

/**
 * Get authentication headers for downloading an artifact.
 * Resolves the registry type from the artifact scope and returns appropriate headers.
 */
function getHeadersForArtifact(artifactId: string, projectRoot: string): Record<string, string> {
  try {
    const { scope } = parseArtifactId(artifactId);
    const localConfig = getLocalConfig(projectRoot);
    const registry = resolveRegistry(scope, localConfig, projectRoot);

    if (registry.type === "gitlab") {
      const token = registry.token || process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
      return getGitLabHeaders(token);
    }

    if (registry.type === "github") {
      const token = registry.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      return getGitHubHeaders(token);
    }

    return {};
  } catch (err) {
    logger.verbose("Failed to resolve headers for artifact:", artifactId, err);
    return {};
  }
}

export const installCommand = new Command("install")
  .alias("i")
  .description("Install artifacts from lockfile (strict mode)")
  .option("--force", "Reinstall even if already present")
  .action(async (options: { force?: boolean }) => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    // Check for lockfile
    if (!lockfileExists(projectRoot)) {
      const config = getConfig(projectRoot);
      const hasArtifactsInConfig = Object.keys(config.artifacts).length > 0;

      if (hasArtifactsInConfig) {
        error("Lockfile missing but grekt.yaml has artifacts");
        info("Run 'grekt add <artifact>' for each artifact to generate lockfile");
      } else {
        info("No artifacts to install");
        info("Run 'grekt add <artifact>' to add artifacts");
      }
      process.exit(1);
    }

    const lockfile = getLockfile(projectRoot);
    const artifacts = Object.entries(lockfile.artifacts);

    if (artifacts.length === 0) {
      info("No artifacts in lockfile");
      return;
    }

    log(colors.bold(`Installing ${artifacts.length} artifact(s)...\n`));

    let installed = 0;
    let skipped = 0;
    let failed = 0;

    for (const [artifactId, entry] of artifacts) {
      // Validate artifact ID to prevent path traversal from corrupted lockfile
      if (!isSafeArtifactId(artifactId)) {
        error(`Skipping unsafe artifact ID: ${artifactId}`);
        failed++;
        continue;
      }

      const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

      // Check if already installed
      if (fs.exists(targetDir) && !options.force) {
        // Verify existing installation
        const integrity = verifyIntegrity(targetDir, entry.files);

        if (integrity.valid) {
          log(`${colors.dim("skip")} ${artifactId}@${entry.version} (already installed)`);
          skipped++;
          continue;
        } else {
          // Existing but corrupted, will reinstall
          warning(`${artifactId} has integrity issues, reinstalling...`);
          fs.rmdir(targetDir, { recursive: true });
        }
      } else if (fs.exists(targetDir) && options.force) {
        fs.rmdir(targetDir, { recursive: true });
      }

      const spin = spinner(`Installing ${artifactId}@${entry.version}...`);
      spin.start();

      let downloadSuccess = false;

      // Use resolved URL if available (strict mode - no recalculation)
      if (entry.resolved) {
        // Get auth headers for the resolved URL based on registry type
        const headers = getHeadersForArtifact(artifactId, projectRoot);
        const result = await downloadAndExtractTarball(entry.resolved, targetDir, { headers });
        downloadSuccess = result.success;
      } else {
        // Fallback for old lockfiles without resolved
        const sourceStr = entry.source || artifactId;
        const source = parseSource(sourceStr);
        fs.mkdir(targetDir, { recursive: true });
        const downloadResult = await downloadFromSource(source, targetDir, projectRoot);
        downloadSuccess = downloadResult.success;

        // Show deprecation warning if applicable
        if (downloadResult.deprecationMessage) {
          spin.stop();
          warning(`${artifactId}@${entry.version} is deprecated: ${downloadResult.deprecationMessage}`);
          spin.start();
        }
      }

      if (!downloadSuccess) {
        spin.stop();
        fs.rmdir(targetDir, { recursive: true });
        error(`Failed to download ${artifactId}`);
        failed++;
        continue;
      }

      // Verify integrity
      const integrity = verifyIntegrity(targetDir, entry.files);

      if (!integrity.valid) {
        spin.stop();

        // Scan for frontmatter errors before deleting
        const scanned = scanArtifact(fs, targetDir);
        const hasValidationErrors = scanned && scanned.invalidFiles.length > 0;

        fs.rmdir(targetDir, { recursive: true });
        error(`Integrity check failed for ${artifactId}`);

        // Show frontmatter validation errors if any
        if (hasValidationErrors) {
          log(colors.dim("  Validation errors:"));
          for (const file of scanned.invalidFiles) {
            const detail = file.details || file.reason;
            log(`    ${file.path}: ${detail}`);
          }
        }

        if (integrity.missingFiles.length > 0) {
          log(`  ${colors.dim("missing:")} ${integrity.missingFiles.join(", ")}`);
        }
        if (integrity.modifiedFiles.length > 0 && !hasValidationErrors) {
          log(`  ${colors.dim("modified:")} ${integrity.modifiedFiles.map((f) => f.path).join(", ")}`);
        }

        failed++;
        continue;
      }

      spin.stop();
      success(`Installed ${artifactId}@${entry.version}`);
      installed++;
    }

    newline();

    if (failed > 0) {
      error(`${failed} artifact(s) failed to install`);
      info("The registry version may differ from lockfile. Try 'grekt add' to update.");
      process.exit(1);
    }

    if (installed > 0) {
      success(`Installed ${installed} artifact(s)`);
    }
    if (skipped > 0) {
      info(`Skipped ${skipped} artifact(s) (already installed)`);
    }

    // Generate artifact index
    const config = getConfig(projectRoot);
    generateArtifactIndex(projectRoot, config);

    if (installed > 0) {
      newline();
      info("Run 'grekt sync' to sync with your AI tools");
    }
  });
