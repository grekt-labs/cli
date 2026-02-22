import { Command } from "commander";
import { getConfig, saveConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { fs } from "#/context";
import { getLockfile, saveLockfile, scanArtifact, hashDirectory } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource } from "#/registry/sources/sources";
import { getSourceDisplayName } from "#/registry/registry";
import { calculateIntegrity } from "@grekt-labs/cli-engine";
import {
  selectComponents,
  selectComponentsWithPrecheck,
  isEmptySelection,
  isFullSelection,
  createEmptySelection,
  type ComponentSelection,
} from "#/artifact/selector/selector";
import { removeUnselectedFiles } from "#/artifact/component-manager/component-manager";
import { generateArtifactIndex } from "#/artifact/index/index";
import { resolveArtifact } from "#/artifact/resolver/resolver";
import {
  getPreviousInstallation,
  computeStructureDiff,
  buildSelectionFromPrevious,
} from "#/artifact/upgrade/upgrade";
import { promptStructuralChanges } from "#/artifact/upgrade/display";
import { success, error, info, log, warning, newline, colors, spinner } from "#/shared/ui/ui";
import { compareSemver, CATEGORIES, type Category } from "@grekt-labs/cli-engine";
import { syncToTargets } from "#/sync/helpers/helpers";
import { promptAndInstallHooks } from "#/sync/hooks";
import { promptAndInstallMcps } from "#/sync/mcp";


export const addCommand = new Command("add")
  .description("Add an artifact from registry, GitHub, GitLab, or local path")
  .argument("[source]", "Artifact source (e.g., @grekt/code-reviewer, github:user/repo, gitlab:host/user/repo, ./local/path)")
  .option("-c, --choose", "Choose which components to install")
  .option("--core", "Mark artifact as CORE (copied to target on sync, not just indexed)")
  .option("--core-sym", "Mark artifact as CORE with symlinks (symlinked to target on sync, not copied)")
  .action(async (sourceArg: string | undefined, options: { choose?: boolean; core?: boolean; coreSym?: boolean }) => {
    if (!sourceArg) {
      error("Source required. Examples:");
      info("  grekt add @scope/artifact");
      info("  grekt add github:user/repo");
      info("  grekt add gitlab:host/user/repo");
      info("  grekt add ./local/path");
      process.exit(1);
    }

    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    // Parse source for display and error hints
    const source = parseSource(sourceArg);
    const displayName = getSourceDisplayName(source);

    const spin = spinner(`Downloading ${displayName}...`);
    spin.start();

    const result = await resolveArtifact(sourceArg, { projectRoot });

    spin.stop();

    if (!result.success) {
      error(`${colors.highlight(displayName)}: ${result.error}`);

      if (source.type === "registry") {
        if (result.error.includes("not found")) {
          info("Verify the artifact name and version are correct");
          info("For custom registries, check .grekt/config.yaml");
        } else if (result.error.includes("network") || result.error.includes("reach")) {
          info("Check your internet connection");
          info("For custom registries, verify the URL in .grekt/config.yaml");
        } else if (result.error.includes("denied") || result.error.includes("auth")) {
          info("This artifact may be private. Run 'grekt login' first");
        }
      } else if (source.type === "github") {
        info("Check the repository exists and you have access");
        info("For private repos, set GITHUB_TOKEN environment variable");
      } else if (source.type === "gitlab") {
        info("Check the repository exists and you have access");
        info("For private repos, set GITLAB_TOKEN environment variable");
      } else if (source.type === "local") {
        info("Check the path exists and contains a valid artifact with grekt.yaml");
      }
      process.exit(1);
    }

    const resolvedArtifactId = result.artifactId;
    const targetDir = `${projectRoot}/${ARTIFACTS_DIR}/${resolvedArtifactId}`;
    const lockfile = getLockfile(projectRoot);

    try {
      // Check if already installed - update if newer version, skip if same/older
      // Local sources always replace (no version comparison)
      if (fs.exists(targetDir)) {
        const existing = lockfile.artifacts[resolvedArtifactId];
        const newVersion = result.version;

        if (existing && source.type !== "local") {
          try {
            const comparison = compareSemver(newVersion, existing.version);
            if (comparison <= 0) {
              fs.rmdir(result.tempDir, { recursive: true });
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
        fs.rmdir(targetDir, { recursive: true });
      }

      // Ensure parent directory exists (for scoped artifacts like @scope/name)
      const parentDir = targetDir.substring(0, targetDir.lastIndexOf("/"));
      if (!fs.exists(parentDir)) {
        fs.mkdir(parentDir, { recursive: true });
      }

      // Move temp dir to final location
      fs.rename(result.tempDir, targetDir);
    } catch (err) {
      if (fs.exists(result.tempDir)) {
        fs.rmdir(result.tempDir, { recursive: true });
      }
      throw err;
    }

    // Scan the installed artifact for component information
    const artifactInfo = scanArtifact(targetDir);

    if (!artifactInfo) {
      fs.rmdir(targetDir, { recursive: true });
      error("Invalid artifact: missing grekt.yaml or invalid structure");
      process.exit(1);
    }

    // Read previous installation state (before modifying config)
    const config = getConfig(projectRoot);
    const previous = getPreviousInstallation(resolvedArtifactId, config);

    // Determine which components to install (default: all)
    let selection: ComponentSelection = createEmptySelection();
    for (const category of CATEGORIES) {
      selection[category] = artifactInfo[category].map((f) => f.path);
    }

    const hasComponents = CATEGORIES.some((cat) => artifactInfo[cat].length > 0);

    if (options.choose && hasComponents) {
      // Explicit --choose flag: show selector
      newline();
      log(`${colors.highlight(resolvedArtifactId)}@${artifactInfo.manifest.version}`);
      newline();

      // Pre-check previous selection if it was partial
      if (previous && previous.mode === "partial" && previous.selection) {
        selection = await selectComponentsWithPrecheck(artifactInfo, previous.selection);
      } else {
        selection = await selectComponents(artifactInfo);
      }

      if (isEmptySelection(selection)) {
        warning("No components selected");
        fs.rmdir(targetDir, { recursive: true });
        process.exit(0);
      }

      removeUnselectedFiles(targetDir, artifactInfo, selection);
    } else if (!options.choose && previous && previous.mode === "partial" && previous.selection) {
      // No --choose flag, but previous was partial: auto-preserve selection
      const diff = computeStructureDiff(previous.selection, artifactInfo);

      if (diff.hasStructuralChanges) {
        selection = await promptStructuralChanges(resolvedArtifactId, diff, artifactInfo, previous.selection);

        if (isEmptySelection(selection)) {
          warning("No components selected");
          fs.rmdir(targetDir, { recursive: true });
          process.exit(0);
        }

        removeUnselectedFiles(targetDir, artifactInfo, selection);
      } else {
        // No structural changes - silently apply previous selection
        selection = buildSelectionFromPrevious(previous.selection, artifactInfo);
        removeUnselectedFiles(targetDir, artifactInfo, selection);
      }
    }
    // else: no --choose, previous was full (or new install) - keep all components

    // Determine sync mode: core-sym > core > previous > lazy
    const resolvedMode = options.coreSym
      ? "core-sym" as const
      : options.core
        ? "core" as const
        : previous?.isCore
          ? previous.artifactMode
          : "lazy" as const;
    const isCore = resolvedMode === "core" || resolvedMode === "core-sym";

    // Check if all components were selected (no --choose or all selected)
    const allSelected = isFullSelection(artifactInfo, selection);

    // Use simple format only if all selected AND not core mode
    if (allSelected && !isCore) {
      // Simple format: just version (LAZY mode by default)
      config.artifacts[resolvedArtifactId] = artifactInfo.manifest.version;
    } else {
      // Detailed format: version + mode + selected components
      const entry: Record<string, unknown> = {
        version: artifactInfo.manifest.version,
      };
      if (isCore) entry.mode = resolvedMode;
      // Add selected components by category
      for (const category of CATEGORIES) {
        if (selection[category].length > 0) {
          entry[category] = selection[category];
        }
      }
      config.artifacts[resolvedArtifactId] = entry as typeof config.artifacts[string];
    }
    saveConfig(config, projectRoot);

    // Recalculate checksums after component selection may have removed files
    const fileHashes = hashDirectory(targetDir);
    const integrity = calculateIntegrity(fileHashes);

    // Update lockfile with version, checksums
    lockfile.artifacts[resolvedArtifactId] = {
      version: artifactInfo.manifest.version,
      integrity,
      source: result.lockfileEntry.source,
      resolved: result.lockfileEntry.resolved,
      mode: resolvedMode,
      files: fileHashes,
    };
    saveLockfile(lockfile, projectRoot);

    // Regenerate artifact index
    generateArtifactIndex(projectRoot, config, lockfile);

    newline();
    const modeLabel = isCore ? ` ${colors.dim(`(${resolvedMode})`)}` : "";
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

    // Install hooks if artifact has them
    if (artifactInfo.hooks.length > 0) {
      await promptAndInstallHooks(projectRoot, resolvedArtifactId, artifactInfo.hooks);
    }

    // Install MCPs if artifact has them
    if (artifactInfo.mcps.length > 0) {
      const allTargets = [...config.targets, ...Object.keys(config.customTargets ?? {})];
      await promptAndInstallMcps(projectRoot, resolvedArtifactId, artifactInfo.mcps, allTargets);
    }

    // Auto-sync to targets
    await syncToTargets(config, lockfile, projectRoot);
  });
