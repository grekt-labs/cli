import { Command } from "commander";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, rmSync, renameSync } from "fs";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getLockfile, saveLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource } from "#/registry/sources/sources";
import { getSourceDisplayName } from "#/registry/registry";
import { scanArtifact, hashDirectory } from "#/context";
import { getArtifactId, calculateIntegrity } from "@grekt-labs/cli-engine";
import { selectComponents, isEmptySelection, isFullSelection, createEmptySelection, type ComponentSelection } from "#/artifact/selector/selector";
import { removeUnselectedFiles } from "#/artifact/component-manager/component-manager";
import { generateArtifactIndex } from "#/artifact/index/index";
import { assertSafeArtifactId } from "#/artifact/validation/validation";
import { success, error, info, log, warning, newline, colors, spinner } from "#/shared/ui/ui";
import { compareSemver, CATEGORIES, type Category } from "@grekt-labs/cli-engine";
import { getPlugin } from "#/sync/manager/manager";


export const addCommand = new Command("add")
  .description("Add an artifact from registry, GitHub, or GitLab")
  .argument("[source]", "Artifact source (e.g., @grekt/code-reviewer, github:user/repo, gitlab:host/user/repo)")
  .option("-c, --choose", "Choose which components to install")
  .option("--core", "Mark artifact as CORE (copied to target on sync, not just indexed)")
  .action(async (sourceArg: string | undefined, options: { choose?: boolean; core?: boolean }) => {
    if (!sourceArg) {
      error("Source required. Examples:");
      info("  grekt add @scope/artifact");
      info("  grekt add github:user/repo");
      info("  grekt add gitlab:host/user/repo");
      process.exit(1);
    }

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
    const tempDir = `${projectRoot}/${ARTIFACTS_DIR}/.tmp-${randomUUID()}`;

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

      if (downloadResult.error) {
        error(`${colors.highlight(displayName)}: ${downloadResult.error}`);
      } else {
        error(`Artifact ${colors.highlight(displayName)} not found`);
      }

      if (source.type === "registry") {
        if (downloadResult.error?.includes("not found")) {
          info("Verify the artifact name and version are correct");
          info("For custom registries, check .grekt/config.yaml");
        } else if (downloadResult.error?.includes("network") || downloadResult.error?.includes("reach")) {
          info("Check your internet connection");
          info("For custom registries, verify the URL in .grekt/config.yaml");
        } else if (downloadResult.error?.includes("denied") || downloadResult.error?.includes("auth")) {
          info("This artifact may be private. Run 'grekt login' first");
        }
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

    // Validate artifact ID to prevent path traversal
    try {
      assertSafeArtifactId(resolvedArtifactId);
    } catch {
      rmSync(tempDir, { recursive: true, force: true });
      error("Invalid artifact: manifest contains unsafe characters in author or name");
      process.exit(1);
    }

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

    // Determine which components to install (default: all)
    let selection: ComponentSelection = createEmptySelection();
    for (const category of CATEGORIES) {
      selection[category] = artifactInfo[category].map((f) => f.path);
    }

    // If --choose flag, let user select components
    if (options.choose) {
      const hasComponents = CATEGORIES.some((cat) => artifactInfo[cat].length > 0);

      if (hasComponents) {
        newline();
        log(`${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}`);
        newline();

        selection = await selectComponents(artifactInfo);

        if (isEmptySelection(selection)) {
          warning("No components selected");
          rmSync(targetDir, { recursive: true, force: true });
          process.exit(0);
        }

        // Remove unselected files from artifact directory
        removeUnselectedFiles(targetDir, artifactInfo, selection);
      }
    }

    // Update grekt.yaml with artifact info
    const config = getConfig(projectRoot);

    // Check if all components were selected (no --choose or all selected)
    const allSelected = isFullSelection(artifactInfo, selection);

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
      // Add selected components by category
      for (const category of CATEGORIES) {
        if (selection[category].length > 0) {
          entry[category] = selection[category];
        }
      }
      config.artifacts[resolvedArtifactId] = entry as typeof config.artifacts[string];
    }
    saveConfig(config, projectRoot);

    // Calculate checksums for all files
    const fileHashes = hashDirectory(targetDir);
    const integrity = calculateIntegrity(fileHashes);

    // Update lockfile with version, checksums
    lockfile.artifacts[resolvedArtifactId] = {
      version: artifactInfo.manifest.version,
      integrity,
      source: source.raw,
      resolved: downloadResult.resolved, // Full URL, immutable after write
      mode: options.core ? "core" : "lazy",
      files: fileHashes,
    };
    saveLockfile(lockfile, projectRoot);

    // Regenerate artifact index
    generateArtifactIndex(projectRoot, config);

    newline();
    const modeLabel = options.core ? ` ${colors.dim("(core)")}` : "";
    success(`Installed ${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}${modeLabel}`);

    // Show what was actually installed
    for (const category of CATEGORIES) {
      const selectedPaths = selection[category];
      if (selectedPaths.length === 0) continue;

      const names = selectedPaths.map((path) => {
        const file = artifactInfo[category].find((f) => f.path === path);
        return file?.parsed.frontmatter["grk-name"] ?? path;
      });
      log(`  ${colors.dim(`${category}:`)} ${names.join(", ")}`);
    }

    // Auto-sync when using --core
    if (options.core && config.targets.length > 0) {
      newline();
      for (const target of config.targets) {
        const plugin = getPlugin(target, config.customTargets);
        const spin = spinner(`Syncing ${plugin.name}...`);
        spin.start();

        const result = await plugin.sync(lockfile, projectRoot, {
          createTarget: true,
          force: true,
          projectConfig: config,
        });

        spin.stop();

        for (const file of result.created) {
          success(`Created ${file}`);
        }
        for (const file of result.updated) {
          info(`Updated ${file}`);
        }
        for (const file of result.skipped) {
          warning(`Skipped ${file}`);
        }
      }
    } else if (!options.core) {
      newline();
      info("Run 'grekt sync' to sync with your AI tools");
    }
  });
