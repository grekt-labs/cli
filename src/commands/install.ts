import { logger } from "#/shared/logger/logger";
import { Command } from "commander";
import { getConfig, getLocalConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile, lockfileExists, createEmptyLockfile, saveLockfile, fs, verifyIntegrity, scanArtifact } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource } from "#/registry/sources/sources";
import { downloadAndExtractTarball } from "#/registry/download/download";
import { generateArtifactIndex } from "#/artifact/index/index";
import { isSafeArtifactId } from "#/artifact/validation/validation";
import { syncToTargets } from "#/sync/helpers/helpers";
import { resolveRegistry } from "#/registry/factory/factory";
import { reconcile, extractMode } from "#/artifact/reconcile/reconcile";
import { resolveArtifact } from "#/artifact/resolver/resolver";
import { removeUnselectedFiles } from "#/artifact/component-manager/component-manager";
import type { ComponentSelection } from "#/artifact/selector/selector";
import { CATEGORIES, parseArtifactId, getGitLabHeaders, getGitHubHeaders } from "@grekt/engine";
import type { ArtifactEntry, Lockfile } from "@grekt/engine";
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

/**
 * Build a component selection from a config entry's category arrays.
 * Returns undefined if the entry has no category selections (full install).
 */
function getConfigSelection(entry: ArtifactEntry): ComponentSelection | undefined {
  if (typeof entry === "string") return undefined;

  const hasSelection = CATEGORIES.some((cat) => entry[cat] && entry[cat]!.length > 0);
  if (!hasSelection) return undefined;

  const selection = {} as ComponentSelection;
  for (const category of CATEGORIES) {
    selection[category] = entry[category] ?? [];
  }
  return selection;
}

/**
 * Install an artifact from its lockfile entry (deterministic, uses resolved URL).
 * Returns true if installation succeeded.
 */
async function installFromLockfile(
  artifactId: string,
  entry: Lockfile["artifacts"][string],
  targetDir: string,
  projectRoot: string,
  force: boolean
): Promise<"installed" | "skipped" | "failed"> {
  // Check if already installed
  if (fs.exists(targetDir) && !force) {
    const integrity = verifyIntegrity(targetDir, entry.files);

    if (integrity.valid) {
      log(`${colors.dim("skip")} ${artifactId}@${entry.version} (already installed)`);
      return "skipped";
    }

    warning(`${artifactId} has integrity issues, reinstalling...`);
    fs.rmdir(targetDir, { recursive: true });
  } else if (fs.exists(targetDir) && force) {
    fs.rmdir(targetDir, { recursive: true });
  }

  const spin = spinner(`Installing ${artifactId}@${entry.version}...`);
  spin.start();

  let downloadSuccess = false;

  // Use resolved URL if available (strict mode - no recalculation)
  if (entry.resolved) {
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
    return "failed";
  }

  // Verify integrity
  const integrity = verifyIntegrity(targetDir, entry.files);

  if (!integrity.valid) {
    spin.stop();

    const scanned = scanArtifact(targetDir);
    const hasValidationErrors = scanned && scanned.invalidFiles.length > 0;

    fs.rmdir(targetDir, { recursive: true });
    error(`Integrity check failed for ${artifactId}`);

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

    return "failed";
  }

  spin.stop();
  success(`Installed ${artifactId}@${entry.version}`);
  return "installed";
}

/**
 * Check if an artifact source is a local path.
 */
function isLocalSource(source: string): boolean {
  return parseSource(source).type === "local";
}

export const installCommand = new Command("install")
  .alias("i")
  .description("Install artifacts from config, using lockfile for determinism")
  .option("--force", "Reinstall even if already present")
  .option("--ci", "Fail on local artifacts (also auto-detected via CI env var)")
  .action(async (options: { force?: boolean; ci?: boolean }) => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    const config = getConfig(projectRoot);
    const configArtifacts = config.artifacts;

    if (Object.keys(configArtifacts).length === 0) {
      info("No artifacts in grekt.yaml");
      info("Run 'grekt add <artifact>' to add artifacts");
      return;
    }

    const lockfile = lockfileExists(projectRoot)
      ? getLockfile(projectRoot)
      : createEmptyLockfile();

    const plan = reconcile(configArtifacts, lockfile.artifacts);

    // Log summary
    const totalActions = plan.toKeep.length + plan.toResolve.length + plan.toPrune.length;
    log(colors.bold(`Processing ${totalActions} artifact(s)...`));

    if (plan.toResolve.length > 0) {
      log(colors.dim(`  ${plan.toResolve.length} to resolve`));
    }
    if (plan.toKeep.length > 0) {
      log(colors.dim(`  ${plan.toKeep.length} from lockfile`));
    }
    if (plan.toPrune.length > 0) {
      log(colors.dim(`  ${plan.toPrune.length} to prune`));
    }
    newline();

    const isCI = options.ci || !!process.env.CI;
    const localArtifacts: string[] = [];

    let installed = 0;
    let skipped = 0;
    let resolved = 0;
    let pruned = 0;
    let failed = 0;

    // Phase 1: Prune artifacts removed from config
    for (const entry of plan.toPrune) {
      const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${entry.artifactId}`;

      if (fs.exists(targetDir)) {
        fs.rmdir(targetDir, { recursive: true });
      }
      delete lockfile.artifacts[entry.artifactId];
      log(`${colors.dim("prune")} ${entry.artifactId}`);
      pruned++;
    }

    // Phase 2: Install kept artifacts from lockfile (deterministic)
    for (const entry of plan.toKeep) {
      if (!isSafeArtifactId(entry.artifactId)) {
        error(`Skipping unsafe artifact ID: ${entry.artifactId}`);
        failed++;
        continue;
      }

      // Skip local artifacts — they cannot be installed from lockfile
      if (isLocalSource(entry.source)) {
        localArtifacts.push(entry.artifactId);
        log(`${colors.dim("skip")} ${entry.artifactId} (local source)`);
        skipped++;
        continue;
      }

      const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${entry.artifactId}`;

      // Update mode from config if it differs from lockfile
      const configEntry = configArtifacts[entry.artifactId];
      const configMode = extractMode(configEntry!);
      if (entry.lockfileEntry && entry.lockfileEntry.mode !== configMode) {
        entry.lockfileEntry.mode = configMode;
        lockfile.artifacts[entry.artifactId] = entry.lockfileEntry;
      }

      const result = await installFromLockfile(
        entry.artifactId,
        entry.lockfileEntry!,
        targetDir,
        projectRoot,
        options.force ?? false
      );

      if (result === "installed") installed++;
      else if (result === "skipped") skipped++;
      else failed++;
    }

    // Phase 3: Resolve new or version-changed artifacts
    for (const entry of plan.toResolve) {
      if (!isSafeArtifactId(entry.artifactId)) {
        error(`Skipping unsafe artifact ID: ${entry.artifactId}`);
        failed++;
        continue;
      }

      // Skip local artifacts — they cannot be resolved during install
      if (isLocalSource(entry.source)) {
        localArtifacts.push(entry.artifactId);
        log(`${colors.dim("skip")} ${entry.artifactId} (local source)`);
        skipped++;
        continue;
      }

      const spin = spinner(`Resolving ${entry.artifactId}${entry.configVersion ? `@${entry.configVersion}` : ""}...`);
      spin.start();

      const result = await resolveArtifact(entry.source, {
        projectRoot,
        version: entry.configVersion,
      });

      spin.stop();

      if (!result.success) {
        error(`Failed to resolve ${entry.artifactId}: ${result.error}`);
        failed++;
        continue;
      }

      const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${result.artifactId}`;

      // Remove old version if it exists
      if (fs.exists(targetDir)) {
        fs.rmdir(targetDir, { recursive: true });
      }

      // Ensure parent directory exists (for scoped artifacts)
      const parentDir = targetDir.substring(0, targetDir.lastIndexOf("/"));
      if (!fs.exists(parentDir)) {
        fs.mkdir(parentDir, { recursive: true });
      }

      // Move resolved artifact to final location
      fs.rename(result.tempDir, targetDir);

      // Apply component selection from config (non-interactive)
      const configEntry = configArtifacts[entry.artifactId];
      const selection = configEntry ? getConfigSelection(configEntry) : undefined;

      if (selection) {
        const artifactInfo = scanArtifact(targetDir);
        if (artifactInfo) {
          removeUnselectedFiles(targetDir, artifactInfo, selection);
        }
      }

      // Set mode from config
      const configMode = configEntry ? extractMode(configEntry) : "lazy";
      result.lockfileEntry.mode = configMode;

      // Update lockfile
      lockfile.artifacts[result.artifactId] = result.lockfileEntry;

      success(`Resolved ${result.artifactId}@${result.version} (${entry.reason})`);
      resolved++;
    }

    const hasChanges = installed > 0 || resolved > 0 || pruned > 0;

    // Save lockfile only if something changed
    if (hasChanges) {
      saveLockfile(lockfile, projectRoot);
    }

    newline();

    if (failed > 0) {
      error(`${failed} artifact(s) failed`);
    }

    if (resolved > 0) {
      success(`Resolved ${resolved} artifact(s)`);
    }
    if (installed > 0) {
      success(`Installed ${installed} artifact(s)`);
    }
    if (skipped > 0) {
      info(`Skipped ${skipped} artifact(s) (already installed)`);
    }
    if (pruned > 0) {
      info(`Pruned ${pruned} artifact(s)`);
    }

    // Only regenerate index and sync if something actually changed
    if (hasChanges) {
      generateArtifactIndex(projectRoot, config, lockfile);
      await syncToTargets(config, lockfile, projectRoot);
    }

    // In CI mode, local artifacts are a hard error
    if (isCI && localArtifacts.length > 0) {
      newline();
      error("Local artifacts detected in CI environment:");
      for (const id of localArtifacts) {
        log(`  ${colors.highlight(id)}`);
      }
      newline();
      error("Local artifacts use filesystem paths that only exist on the author's machine.");
      info("Replace them with registry, GitHub, or GitLab sources before pushing.");
      process.exit(1);
    }

    if (failed > 0) {
      process.exit(1);
    }
  });
