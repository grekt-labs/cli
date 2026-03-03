import { Command } from "commander";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import { fs } from "#/context";
import {
  ProjectConfigSchema,
  safeParseYaml,
  hasManifestFields,
  parseName,
  bumpVersion,
  bumpPrerelease,
  isWorkspaceRoot,
  type BumpType,
} from "@grekt-labs/cli-engine";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";
import {
  loadWorkspace,
  generateWorkspaceFile,
  cleanWorkspaceFile,
  generatePackageJsonFiles,
  syncVersionsToManifest,
  cleanPackageJsonFiles,
} from "#/workspace/workspace";
import { backupFiles } from "#/workspace/file-backup/file-backup";

const MANIFEST_FILE = "grekt.yaml";
const BUMP_TYPES = ["patch", "minor", "major", "prerelease"] as const;
const PRERELEASE_IDENTIFIER = "beta";

type ExtendedBumpType = BumpType | "prerelease";

interface VersionCommandOptions {
  dryRun?: boolean;
  beta?: boolean;
  exec?: string;
}

function isValidBumpType(value: string): value is ExtendedBumpType {
  return BUMP_TYPES.includes(value as ExtendedBumpType);
}

export const versionCommand = new Command("version")
  .description("Bump artifact versions (patch, minor, major, prerelease)")
  .argument("[bump]", "Bump type: patch, minor, major, or prerelease")
  .argument("[path]", "Path to artifact or directory containing artifacts", ".")
  .option("--dry-run", "Show what would happen without applying changes")
  .option("--beta", "Use beta identifier for prerelease (required with prerelease)")
  .option("--exec <command>", "Run external versioning command (generates temp package.json for compatibility)")
  .action(async (bump: string | undefined, targetPath: string, options: VersionCommandOptions) => {
    const cwd = process.cwd();

    // --exec mode: delegate to external tool with package.json compatibility
    if (options.exec) {
      await handleExecMode({ cwd, command: options.exec, dryRun: options.dryRun });
      return;
    }

    // Standard bump mode
    if (!bump) {
      error("Bump type required. Usage:");
      info("  grekt version patch");
      info("  grekt version minor");
      info("  grekt version major");
      info("  grekt version prerelease --beta");
      info("");
      info("Or use external versioning tool:");
      info("  grekt version --exec \"npx changeset version\"");
      process.exit(1);
    }

    if (!isValidBumpType(bump)) {
      error(`Invalid bump type: ${bump}`);
      info("Use: patch, minor, major, or prerelease");
      process.exit(1);
    }

    if (bump === "prerelease" && !options.beta) {
      error("Prerelease requires --beta flag");
      info("Usage: grekt version prerelease --beta");
      process.exit(1);
    }

    const absolutePath = resolve(targetPath);

    if (!fs.exists(absolutePath)) {
      error(`Path not found: ${absolutePath}`);
      process.exit(1);
    }

    // Find all artifacts (directories with grekt.yaml)
    const artifactPaths = findArtifacts(absolutePath);

    if (artifactPaths.length === 0) {
      error("No artifacts found (directories with grekt.yaml)");
      process.exit(1);
    }

    log("");
    info(`Found ${artifactPaths.length} artifact(s)`);

    if (options.dryRun) {
      log(colors.dim("  (dry-run mode)"));
    }
    log("");

    let updated = 0;

    for (const artifactPath of artifactPaths) {
      const manifestPath = join(artifactPath, MANIFEST_FILE);
      const manifestContent = fs.readFile(manifestPath);
      const result = safeParseYaml(manifestContent, ProjectConfigSchema, manifestPath);

      if (!result.success) {
        error(result.error.message);
        result.error.details?.forEach((detail) => info(`  ${detail}`));
        process.exit(1);
      }

      const config = result.data;

      if (!hasManifestFields(config)) {
        error(`Cannot bump version: ${manifestPath}`);
        info("Missing required fields: name, version, description");
        info("This grekt.yaml is not a publishable artifact");
        process.exit(1);
      }

      const { artifactId } = parseName(config.name);

      const newVersion = bump === "prerelease"
        ? bumpPrerelease(config.version, PRERELEASE_IDENTIFIER)
        : bumpVersion(config.version, bump);

      log(`  ${artifactId}: ${config.version} → ${newVersion}`);

      if (!options.dryRun) {
        const updatedContent = manifestContent.replace(
          /^version:\s*["']?[\d.]+[-\w.]*["']?/m,
          `version: "${newVersion}"`
        );
        fs.writeFile(manifestPath, updatedContent);
        updated++;
      }
    }

    log("");

    if (options.dryRun) {
      info("Dry run complete");
    } else if (updated > 0) {
      success(`Updated ${updated} artifact(s)`);
    }
  });

/**
 * Handle --exec mode: generate package.json, run command, sync back, cleanup.
 */
async function handleExecMode(options: { cwd: string; command: string; dryRun?: boolean }): Promise<void> {
  const { cwd, command, dryRun } = options;
  if (!isWorkspaceRoot(fs, cwd)) {
    error("--exec requires a workspace (grekt-workspace.yaml not found)");
    info("Run this command from your workspace root");
    process.exit(1);
  }

  const workspace = await loadWorkspace(cwd);

  if (!workspace || workspace.artifacts.length === 0) {
    error("No artifacts found in workspace");
    process.exit(1);
  }

  log("");
  info(`Workspace: ${workspace.artifacts.length} artifact(s)`);

  if (dryRun) {
    log(colors.dim("  (dry-run mode - no changes will be made)"));
    log("");
    info("Would generate package.json files for:");
    for (const artifact of workspace.artifacts) {
      log(`  ${artifact.manifest.name} ${colors.dim(`v${artifact.manifest.version}`)}`);
    }
    log("");
    info(`Would run: ${command}`);
    return;
  }

  // Step 0: Backup existing files that will be overwritten
  const filesToTouch = [
    join(cwd, "pnpm-workspace.yaml"),
    join(cwd, "package.json"),
    ...workspace.artifacts.map((a) => join(a.path, "package.json")),
  ];
  const manifest = backupFiles(filesToTouch);

  // Step 1: Generate temporary workspace config files
  const genSpin = spinner("Generating workspace config files...");
  genSpin.start();
  generateWorkspaceFile(cwd, workspace.artifacts);
  generatePackageJsonFiles(workspace.artifacts);
  genSpin.stop();
  success("Generated workspace config files");

  // Step 2: Run external command
  log("");
  info(`Running: ${command}`);
  log("");

  const result = spawnSync(command, {
    shell: true,
    cwd,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    // Cleanup on failure
    cleanWorkspaceFile(cwd, manifest);
    cleanPackageJsonFiles(workspace.artifacts, manifest);
    error(`Command failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }

  // Step 3: Sync versions back to grekt.yaml
  log("");
  const syncSpin = spinner("Syncing versions to grekt.yaml...");
  syncSpin.start();

  // Reload workspace to get updated artifacts
  const updatedWorkspace = await loadWorkspace(cwd);
  if (!updatedWorkspace) {
    syncSpin.stop();
    cleanWorkspaceFile(cwd, manifest);
    cleanPackageJsonFiles(workspace.artifacts, manifest);
    error("Failed to reload workspace");
    process.exit(1);
  }

  const updated = syncVersionsToManifest(updatedWorkspace.artifacts);
  syncSpin.stop();

  if (updated > 0) {
    success(`Updated ${updated} grekt.yaml file(s)`);
  } else {
    info("No version changes detected");
  }

  // Step 4: Cleanup
  const cleanSpin = spinner("Cleaning up...");
  cleanSpin.start();
  cleanWorkspaceFile(cwd, manifest);
  cleanPackageJsonFiles(workspace.artifacts, manifest);
  cleanSpin.stop();
  success("Removed temporary config files");

  log("");
  success("Version update complete");
}

/**
 * Find all directories containing grekt.yaml
 */
function findArtifacts(basePath: string): string[] {
  const artifacts: string[] = [];

  // Check if basePath itself is an artifact
  if (fs.exists(join(basePath, MANIFEST_FILE))) {
    artifacts.push(basePath);
    return artifacts;
  }

  // Scan subdirectories
  try {
    const entries = fs.readdir(basePath);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const subPath = join(basePath, entry);
      const stat = fs.stat(subPath);
      if (stat.isDirectory && fs.exists(join(subPath, MANIFEST_FILE))) {
        artifacts.push(subPath);
      }
    }
  } catch {
    // Ignore read errors
  }

  return artifacts;
}
