import { resolve, basename, join } from "path";
import fg from "fast-glob";
import {
  parseFrontmatter,
  getSafeFilename,
  getCategoriesForFormat,
  generateDefaultBlockContent,
  GREKT_SECTION_HEADER,
  isValidCategory,
  type Category,
  type ScannedFile,
  type InvalidFile,
} from "@grekt-labs/cli-engine";
import { fs } from "#/context";
import { getPlugin, getAvailableTargets } from "#/sync/manager/manager";
import { findEntryPointPath } from "#/sync/base/base";
import { resolveAndAssertWithinBase } from "#/artifact/validation/validation";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { success, info, warning, log, colors, spinner } from "#/shared/ui/ui";
import type { StandaloneSyncOptions, StandaloneSyncResult, ScanResult } from "./standalone.types";

const SYNCABLE_CATEGORIES = getCategoriesForFormat("md");

/**
 * Recursively scan a directory for .md files with valid frontmatter.
 * Groups files by their grk-type category. No grekt.yaml required.
 */
export function scanDirectory(sourceDir: string): ScanResult {
  const absoluteDir = resolve(sourceDir);

  const mdFiles = fg.sync("**/*.md", {
    cwd: absoluteDir,
    absolute: false,
    dot: false,
    ignore: ["node_modules/**", ".git/**"],
  });

  const result: ScanResult = {
    files: {} as Record<Category, ScannedFile[]>,
    invalidFiles: [],
  };

  for (const category of SYNCABLE_CATEGORIES) {
    result.files[category] = [];
  }

  for (const filePath of mdFiles) {
    const absolutePath = join(absoluteDir, filePath);
    const content = fs.readFile(absolutePath);
    const parsed = parseFrontmatter(content);

    if (!parsed.success) {
      result.invalidFiles.push({
        path: filePath,
        reason: parsed.reason,
        missingFields: parsed.missingFields,
        details: parsed.details,
      });
      continue;
    }

    const category = parsed.parsed.frontmatter["grk-type"];

    if (!isValidCategory(category)) {
      result.invalidFiles.push({
        path: filePath,
        reason: "missing-type",
      });
      continue;
    }

    if (!SYNCABLE_CATEGORIES.includes(category)) {
      result.invalidFiles.push({
        path: filePath,
        reason: "invalid-type-for-format",
        details: `Category "${category}" is not syncable for markdown format`,
      });
      continue;
    }

    result.files[category].push({
      path: filePath,
      parsed: parsed.parsed,
    });
  }

  return result;
}

/**
 * Validate standalone sync options before execution.
 * Throws descriptive errors for invalid configurations.
 */
function validateOptions(options: StandaloneSyncOptions): void {
  const absoluteSource = resolve(options.sourceDir);

  if (!fs.exists(absoluteSource)) {
    throw new Error(`Source directory not found: ${options.sourceDir}`);
  }

  const stat = fs.stat(absoluteSource);
  if (!stat.isDirectory) {
    throw new Error(`Source path is not a directory: ${options.sourceDir}`);
  }

  const customTargetIds: string[] = [];
  const invalidTargets = options.targets.filter(
    (t) => !getAvailableTargets().includes(t) && !customTargetIds.includes(t)
  );

  if (invalidTargets.length > 0) {
    throw new Error(
      `Unknown targets: ${invalidTargets.join(", ")}. Available: ${getAvailableTargets().join(", ")}`
    );
  }
}

/**
 * Sync files from a local directory to AI tool targets.
 * Does not require grekt.yaml, lockfile, or .grekt/ directory.
 */
export async function syncFromDirectory(options: StandaloneSyncOptions): Promise<StandaloneSyncResult> {
  const { sourceDir, artifactId, targets, projectRoot, dryRun = false } = options;

  validateOptions(options);

  const absoluteSource = resolve(sourceDir);
  const scanResult = scanDirectory(absoluteSource);

  const totalFiles = SYNCABLE_CATEGORIES.reduce(
    (sum, category) => sum + scanResult.files[category].length,
    0
  );

  if (totalFiles === 0) {
    let message = `No syncable components found in ${sourceDir}`;
    if (scanResult.invalidFiles.length > 0) {
      const invalidList = scanResult.invalidFiles
        .map((f) => `  - ${f.path}: ${f.reason}${f.details ? ` (${f.details})` : ""}`)
        .join("\n");
      message += `\n\nInvalid files found:\n${invalidList}`;
    }
    throw new Error(message);
  }

  const result: StandaloneSyncResult = {
    artifactId,
    totalCreated: 0,
    totalUpdated: 0,
    totalSkipped: 0,
  };

  for (const target of targets) {
    const plugin = getPlugin(target);
    const syncPaths = plugin.getSyncPaths();

    if (!syncPaths) {
      warning(`Skipping ${plugin.name} (does not support file sync)`);
      result.totalSkipped++;
      continue;
    }

    if (dryRun) {
      log(colors.bold(`\n${plugin.name}:`));
    }

    const targetExists = plugin.targetExists(projectRoot);

    if (!targetExists && !dryRun) {
      plugin.setup?.(projectRoot);
    }

    if (!dryRun) {
      const spin = spinner(`Syncing to ${plugin.name}...`);
      spin.start();

      syncFilesToTarget(absoluteSource, scanResult, plugin, artifactId, projectRoot, syncPaths, result);
      updateEntryPoint(plugin, projectRoot, result);

      spin.stop();
    } else {
      previewFilesToTarget(absoluteSource, scanResult, plugin, artifactId, projectRoot, syncPaths, result);
    }
  }

  return result;
}

/**
 * Copy scanned files to a target plugin's directories.
 */
function syncFilesToTarget(
  absoluteSource: string,
  scanResult: ScanResult,
  plugin: ReturnType<typeof getPlugin>,
  artifactId: string,
  projectRoot: string,
  syncPaths: Record<Category, string>,
  result: StandaloneSyncResult,
): void {
  for (const category of SYNCABLE_CATEGORIES) {
    const files = scanResult.files[category];
    if (!files || files.length === 0) continue;

    const categoryDir = syncPaths[category];

    for (const scannedFile of files) {
      const sourcePath = join(absoluteSource, scannedFile.path);
      const targetName = plugin.resolveTargetPath
        ? plugin.resolveTargetPath(artifactId, category, scannedFile.path)
        : getSafeFilename(artifactId, scannedFile.path);

      try {
        resolveAndAssertWithinBase(absoluteSource, scannedFile.path);
        resolveAndAssertWithinBase(`${projectRoot}/${categoryDir}`, targetName);
      } catch {
        warning(`Skipped ${scannedFile.path} (unsafe path)`);
        result.totalSkipped++;
        continue;
      }

      const targetPath = `${projectRoot}/${categoryDir}/${targetName}`;
      const existed = fs.exists(targetPath);

      ensureDir(targetPath);

      const content = fs.readFile(sourcePath);
      fs.writeFile(targetPath, content);

      const relativePath = `${categoryDir}/${targetName}`;

      if (existed) {
        info(`Updated ${relativePath}`);
        result.totalUpdated++;
      } else {
        success(`Created ${relativePath}`);
        result.totalCreated++;
      }
    }
  }
}

/**
 * Preview what files would be synced without making changes.
 */
function previewFilesToTarget(
  absoluteSource: string,
  scanResult: ScanResult,
  plugin: ReturnType<typeof getPlugin>,
  artifactId: string,
  projectRoot: string,
  syncPaths: Record<Category, string>,
  result: StandaloneSyncResult,
): void {
  for (const category of SYNCABLE_CATEGORIES) {
    const files = scanResult.files[category];
    if (!files || files.length === 0) continue;

    const categoryDir = syncPaths[category];

    for (const scannedFile of files) {
      const targetName = plugin.resolveTargetPath
        ? plugin.resolveTargetPath(artifactId, category, scannedFile.path)
        : getSafeFilename(artifactId, scannedFile.path);

      const targetPath = `${projectRoot}/${categoryDir}/${targetName}`;
      const relativePath = `${categoryDir}/${targetName}`;

      if (fs.exists(targetPath)) {
        log(`  ${colors.info("~")} Would update: ${relativePath}`);
        result.totalUpdated++;
      } else {
        log(`  ${colors.success("+")} Would create: ${relativePath}`);
        result.totalCreated++;
      }
    }
  }
}

/**
 * Update the entry point file (e.g., CLAUDE.md) with grekt section if not present.
 */
function updateEntryPoint(
  plugin: ReturnType<typeof getPlugin>,
  projectRoot: string,
  result: StandaloneSyncResult,
): void {
  const targetPaths = plugin.getTargetPaths();
  if (!targetPaths) return;

  const entryPoints = targetPaths.entryPoints;
  const primaryEntryPoint = entryPoints[0];
  if (!primaryEntryPoint) return;

  // Find existing entry point (case-insensitive)
  let entryPointPath: string | null = null;

  for (const ep of entryPoints) {
    const resolved = findEntryPointPath(projectRoot, ep);
    if (fs.exists(resolved)) {
      entryPointPath = resolved;
      break;
    }
  }

  if (!entryPointPath) {
    // Create the primary entry point
    const filepath = join(projectRoot, primaryEntryPoint);
    ensureDir(filepath);
    const content = generateDefaultBlockContent();
    fs.writeFile(filepath, content + "\n");
    success(`Created ${primaryEntryPoint}`);
    result.totalCreated++;
    return;
  }

  const content = fs.readFile(entryPointPath);

  if (content.includes(GREKT_SECTION_HEADER)) {
    return;
  }

  const managedBlock = generateDefaultBlockContent();
  fs.writeFile(entryPointPath, managedBlock + "\n\n" + content.trimStart());
  info(`Updated ${basename(entryPointPath)}`);
  result.totalUpdated++;
}
