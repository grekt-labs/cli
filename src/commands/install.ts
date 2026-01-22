import { Command } from "commander";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { isInitialized, getConfig } from "#/lib/config";
import { getLockfile, lockfileExists } from "#/lib/lockfile";
import { ARTIFACTS_DIR } from "#/lib/paths";
import { parseSource, downloadFromSource } from "#/lib/sources";
import { hashDirectory, verifyIntegrity } from "#/lib/integrity";
import { success, error, info, warning, log, newline, colors, spinner } from "#/utils/ui";

/**
 * Download directly from a resolved URL
 */
async function downloadFromUrl(url: string, targetDir: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "grekt-cli" },
    });

    if (!response.ok) {
      return false;
    }

    const buffer = await response.arrayBuffer();
    const tempTarball = `/tmp/grekt-${Date.now()}.tar.gz`;
    writeFileSync(tempTarball, Buffer.from(buffer));

    mkdirSync(targetDir, { recursive: true });
    execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
      stdio: "pipe",
    });
    execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

    return true;
  } catch {
    return false;
  }
}

export const installCommand = new Command("install")
  .alias("i")
  .description("Install artifacts from lockfile (strict mode)")
  .option("--force", "Reinstall even if already present")
  .action(async (options: { force?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

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
      const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

      // Check if already installed
      if (existsSync(targetDir) && !options.force) {
        // Verify existing installation
        const integrity = verifyIntegrity(targetDir, entry.files);

        if (integrity.valid) {
          log(`${colors.dim("skip")} ${artifactId}@${entry.version} (already installed)`);
          skipped++;
          continue;
        } else {
          // Existing but corrupted, will reinstall
          warning(`${artifactId} has integrity issues, reinstalling...`);
          rmSync(targetDir, { recursive: true, force: true });
        }
      } else if (existsSync(targetDir) && options.force) {
        rmSync(targetDir, { recursive: true, force: true });
      }

      const spin = spinner(`Installing ${artifactId}@${entry.version}...`);
      spin.start();

      let downloadSuccess = false;

      // Use resolved URL if available (strict mode - no recalculation)
      if (entry.resolved) {
        mkdirSync(targetDir, { recursive: true });
        downloadSuccess = await downloadFromUrl(entry.resolved, targetDir);
      } else {
        // Fallback for old lockfiles without resolved
        const sourceStr = entry.source || artifactId;
        const source = parseSource(sourceStr);
        mkdirSync(targetDir, { recursive: true });
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
        rmSync(targetDir, { recursive: true, force: true });
        error(`Failed to download ${artifactId}`);
        failed++;
        continue;
      }

      // Verify integrity
      const actualHashes = hashDirectory(targetDir);
      const integrity = verifyIntegrity(targetDir, entry.files);

      if (!integrity.valid) {
        spin.stop();
        rmSync(targetDir, { recursive: true, force: true });
        error(`Integrity check failed for ${artifactId}`);

        if (integrity.missingFiles.length > 0) {
          log(`  ${colors.dim("missing:")} ${integrity.missingFiles.join(", ")}`);
        }
        if (integrity.modifiedFiles.length > 0) {
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

    if (installed > 0) {
      newline();
      info("Run 'grekt sync' to sync with your AI tools");
    }
  });
