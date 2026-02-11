import { basename, dirname, join } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview, FolderPluginConfig, RulesOnlyPluginConfig, TargetPaths } from "#/sync/sync.types";
import {
  type Lockfile,
  type ProjectConfig,
  type ArtifactMode,
  type Category,
  CATEGORIES,
  CATEGORY_CONFIG,
  getCategoriesForFormat,
  scanArtifact,
} from "@grekt-labs/cli-engine";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getSafeFilename, generateDefaultBlockContent, GREKT_SECTION_HEADER, GREKT_ENTRY_POINT_TEXT } from "@grekt-labs/cli-engine";
import { fs } from "#/context";

// MD categories can be synced to folder targets
const SYNCABLE_CATEGORIES = getCategoriesForFormat("md");

// Re-export for external use
export { generateDefaultBlockContent, GREKT_ENTRY_POINT_TEXT } from "@grekt-labs/cli-engine";

// Utility functions
export function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!fs.exists(dir)) {
    fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Find the actual path of an entry point file, matching case-insensitively.
 * Returns the real path if a case-variant exists, otherwise returns the canonical path.
 */
export function findEntryPointPath(projectRoot: string, entryPoint: string): string {
  const dir = dirname(entryPoint);
  const filename = basename(entryPoint);
  const fullDir = `${projectRoot}/${dir}`;

  if (!fs.exists(fullDir)) return `${projectRoot}/${entryPoint}`;

  const files = fs.readdir(fullDir);
  const match = files.find((f) => f.toLowerCase() === filename.toLowerCase());

  return match ? `${projectRoot}/${dir}/${match}` : `${projectRoot}/${entryPoint}`;
}

// Re-export for backwards compatibility
export { getSafeFilename } from "@grekt-labs/cli-engine";
export type { FolderPluginConfig, RulesOnlyPluginConfig, TargetPaths } from "@grekt-labs/cli-engine";

/**
 * Get the sync mode for an artifact from the project config.
 * Default is "lazy" if not specified.
 */
function getArtifactMode(config: ProjectConfig | undefined, artifactId: string): ArtifactMode {
  if (!config) return "lazy";

  const entry = config.artifacts[artifactId];
  if (!entry) return "lazy";

  if (typeof entry === "string") {
    return "lazy"; // Version string = lazy mode
  }

  return entry.mode ?? "lazy";
}

/**
 * Check if an artifact should be synced (copied to target).
 * Only CORE mode artifacts are copied. LAZY mode artifacts are only in the index.
 */
function shouldSyncArtifact(config: ProjectConfig | undefined, artifactId: string): boolean {
  return getArtifactMode(config, artifactId) === "core";
}

/**
 * Find the first existing entry point from an array of candidates.
 * Searches case-insensitively. Returns the resolved path and the original entry point string.
 * If none exist, returns null.
 */
function findExistingEntryPoint(
  projectRoot: string,
  entryPoints: string[]
): { resolvedPath: string; entryPoint: string } | null {
  for (const entryPoint of entryPoints) {
    const resolved = findEntryPointPath(projectRoot, entryPoint);
    if (fs.exists(resolved)) {
      return { resolvedPath: resolved, entryPoint };
    }
  }
  return null;
}

/**
 * Remove previously synced files for an artifact from target directories.
 * Handles both flat files and folder-based targets (e.g., Claude skills).
 */
function cleanupArtifactFiles(
  projectRoot: string,
  artifactId: string,
  getCategoryDir: (category: Category) => string,
  getTargetPathFn: (artifactId: string, category: Category, filePath: string) => string,
): void {
  const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
  const artifactInfo = scanArtifact(fs, artifactDir);
  if (!artifactInfo) return;

  for (const category of SYNCABLE_CATEGORIES) {
    const categoryDir = getCategoryDir(category);
    const files = artifactInfo[category];
    if (!files || files.length === 0) continue;

    for (const scannedFile of files) {
      const targetName = getTargetPathFn(artifactId, category, scannedFile.path);
      const targetPath = `${projectRoot}/${categoryDir}/${targetName}`;

      if (fs.exists(targetPath)) {
        fs.unlink(targetPath);

        // Clean up parent directory if target was inside a subfolder
        const parentDir = dirname(targetPath);
        const categoryFullPath = `${projectRoot}/${categoryDir}`;
        if (parentDir !== categoryFullPath) {
          cleanEmptyDir(parentDir);
        }
      }
    }

    cleanEmptyDir(`${projectRoot}/${categoryDir}`);
  }
}

/**
 * Remove directory if empty
 */
function cleanEmptyDir(dir: string): void {
  if (fs.exists(dir)) {
    const files = fs.readdir(dir);
    if (files.length === 0) {
      fs.rmdir(dir, { recursive: true });
    }
  }
}

/**
 * Create a folder-based plugin that syncs artifacts to category subfolders.
 * Optionally updates a rules file (like CLAUDE.md).
 */
export function createFolderPlugin(config: FolderPluginConfig): SyncPlugin {
  const { id, name, targetDir, entryPoints, generateRulesContent } = config;

  // Build category paths from config or defaults
  function getCategoryDir(category: Category): string {
    return config.paths?.[category] ?? join(targetDir, CATEGORY_CONFIG[category].defaultPath);
  }

  function buildSyncPaths(): Record<Category, string> {
    const paths = {} as Record<Category, string>;
    for (const category of CATEGORIES) {
      paths[category] = getCategoryDir(category);
    }
    return paths;
  }

  function updateContextEntryPoint(projectRoot: string, lockfile: Lockfile, result: SyncResult): void {
    if (!entryPoints || entryPoints.length === 0 || !generateRulesContent) return;

    const managedBlock = generateRulesContent(lockfile);

    // Find first existing entry point
    const existing = findExistingEntryPoint(projectRoot, entryPoints);

    if (!existing) {
      // None exist — create at first entry point
      const primaryEntryPoint = entryPoints[0];
      const filepath = `${projectRoot}/${primaryEntryPoint}`;
      ensureDir(filepath);
      fs.writeFile(filepath, managedBlock + "\n");
      result.created.push(primaryEntryPoint);
      return;
    }

    const content = fs.readFile(existing.resolvedPath);

    // If section header already exists, nothing to do
    if (content.includes(GREKT_SECTION_HEADER)) {
      return;
    }

    // Prepend to file
    fs.writeFile(existing.resolvedPath, managedBlock + "\n\n" + content.trimStart());
    result.updated.push(basename(existing.resolvedPath));
  }

  function getTargetPath(artifactId: string, category: Category, filePath: string): string {
    if (config.getTargetPath) {
      const customPath = config.getTargetPath(artifactId, category, filePath);
      if (customPath) return customPath;
    }
    return getSafeFilename(artifactId, filePath);
  }

  return {
    id,
    name,
    targetFile: targetDir,
    setup: config.setup,

    targetExists(projectRoot: string): boolean {
      return fs.exists(`${projectRoot}/${targetDir}`);
    },

    getSyncPaths(): Record<Category, string> {
      return buildSyncPaths();
    },

    getTargetPaths(): TargetPaths {
      return {
        targetDir,
        entryPoints: entryPoints ?? [],
      };
    },

    resolveTargetPath(artifactId: string, category: Category, filePath: string): string {
      return getTargetPath(artifactId, category, filePath);
    },

    async sync(lockfile: Lockfile, projectRoot: string, options: SyncOptions): Promise<SyncResult> {
      const result: SyncResult = { created: [], updated: [], skipped: [] };

      if (options.dryRun) {
        const preview = this.preview(lockfile, projectRoot);
        return {
          created: preview.willCreate,
          updated: preview.willUpdate,
          skipped: preview.willSkip,
        };
      }

      // Create target directories
      const dirs = [targetDir, ...SYNCABLE_CATEGORIES.map(getCategoryDir)];
      for (const dir of dirs) {
        const fullPath = `${projectRoot}/${dir}`;
        if (!fs.exists(fullPath)) {
          fs.mkdir(fullPath, { recursive: true });
        }
      }

      // Sync each artifact (only CORE mode artifacts are copied)
      for (const [artifactId] of Object.entries(lockfile.artifacts)) {
        if (!shouldSyncArtifact(options.projectConfig, artifactId)) {
          // Clean up previously synced files for CORE→LAZY transitions
          cleanupArtifactFiles(projectRoot, artifactId, getCategoryDir, getTargetPath);

          result.skipped.push(`${artifactId} (lazy mode)`);
          continue;
        }

        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        // Scan artifact to determine file categories from frontmatter
        const artifactInfo = scanArtifact(fs, artifactDir);
        if (!artifactInfo) {
          result.skipped.push(`${artifactId} (invalid artifact)`);
          continue;
        }

        // Copy files for each syncable category
        for (const category of SYNCABLE_CATEGORIES) {
          const categoryDir = getCategoryDir(category);
          const files = artifactInfo[category];

          if (!files || files.length === 0) continue;

          for (const scannedFile of files) {
            const filePath = scannedFile.path;
            const source = join(artifactDir, filePath);
            const targetName = getTargetPath(artifactId, category, filePath);
            const target = `${projectRoot}/${categoryDir}/${targetName}`;

            if (fs.exists(source)) {
              ensureDir(target);
              const existed = fs.exists(target);
              fs.copyFile(source, target);
              if (existed) {
                result.updated.push(`${categoryDir}/${targetName}`);
              } else {
                result.created.push(`${categoryDir}/${targetName}`);
              }
            } else {
              result.skipped.push(`${artifactId}/${filePath} (source not found)`);
            }
          }
        }
      }

      updateContextEntryPoint(projectRoot, lockfile, result);
      return result;
    },

    preview(lockfile: Lockfile, projectRoot: string, options?: SyncOptions): SyncPreview {
      const preview: SyncPreview = { willCreate: [], willUpdate: [], willSkip: [] };

      if (!fs.exists(`${projectRoot}/${targetDir}`)) {
        preview.willCreate.push(targetDir);
      }

      for (const [artifactId] of Object.entries(lockfile.artifacts)) {
        if (!shouldSyncArtifact(options?.projectConfig, artifactId)) {
          preview.willSkip.push(`${artifactId} (lazy mode)`);
          continue;
        }

        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        // Scan artifact to determine file categories from frontmatter
        const artifactInfo = scanArtifact(fs, artifactDir);
        if (!artifactInfo) {
          preview.willSkip.push(`${artifactId} (invalid artifact)`);
          continue;
        }

        for (const category of SYNCABLE_CATEGORIES) {
          const categoryDir = getCategoryDir(category);
          const files = artifactInfo[category];

          if (!files || files.length === 0) continue;

          for (const scannedFile of files) {
            const filePath = scannedFile.path;
            const source = join(artifactDir, filePath);
            const targetName = getTargetPath(artifactId, category, filePath);
            const target = `${projectRoot}/${categoryDir}/${targetName}`;

            if (!fs.exists(source)) {
              preview.willSkip.push(`${artifactId}/${filePath} (source not found)`);
            } else if (fs.exists(target)) {
              preview.willUpdate.push(`${categoryDir}/${targetName}`);
            } else {
              preview.willCreate.push(`${categoryDir}/${targetName}`);
            }
          }
        }
      }

      if (entryPoints && entryPoints.length > 0) {
        const existing = findExistingEntryPoint(projectRoot, entryPoints);
        if (!existing) {
          preview.willCreate.push(entryPoints[0]);
        } else {
          preview.willUpdate.push(basename(existing.resolvedPath));
        }
      }

      return preview;
    },
  };
}

/**
 * Create a rules-only plugin that only updates a context entry point file (no folder sync).
 */
export function createRulesOnlyPlugin(config: RulesOnlyPluginConfig): SyncPlugin {
  const { id, name, entryPoints, generateRulesContent } = config;

  return {
    id,
    name,
    targetFile: entryPoints[0],

    targetExists(projectRoot: string): boolean {
      return findExistingEntryPoint(projectRoot, entryPoints) !== null;
    },

    getSyncPaths(): null {
      return null;
    },

    getTargetPaths(): TargetPaths {
      return {
        targetDir: "",
        entryPoints,
      };
    },

    resolveTargetPath(artifactId: string, _category: Category, filePath: string): string {
      return getSafeFilename(artifactId, filePath);
    },

    async sync(lockfile: Lockfile, projectRoot: string, options: SyncOptions): Promise<SyncResult> {
      const result: SyncResult = { created: [], updated: [], skipped: [] };

      if (options.dryRun) {
        const preview = this.preview(lockfile, projectRoot);
        return {
          created: preview.willCreate,
          updated: preview.willUpdate,
          skipped: preview.willSkip,
        };
      }

      const existing = findExistingEntryPoint(projectRoot, entryPoints);
      const managedBlock = generateRulesContent(lockfile);

      if (!existing) {
        if (!options.createTarget) {
          result.skipped.push(`${entryPoints[0]} (file doesn't exist)`);
          return result;
        }
        const primaryPath = `${projectRoot}/${entryPoints[0]}`;
        ensureDir(primaryPath);
        fs.writeFile(primaryPath, managedBlock);
        result.created.push(entryPoints[0]);
        return result;
      }

      const content = fs.readFile(existing.resolvedPath);

      // If section header already exists, nothing to do
      if (content.includes(GREKT_SECTION_HEADER)) {
        return result;
      }

      // Prepend to file
      fs.writeFile(existing.resolvedPath, managedBlock + "\n\n" + content.trimStart());
      result.updated.push(basename(existing.resolvedPath));
      return result;
    },

    preview(_lockfile: Lockfile, projectRoot: string, _options?: SyncOptions): SyncPreview {
      const existing = findExistingEntryPoint(projectRoot, entryPoints);

      if (!existing) {
        return {
          willCreate: [entryPoints[0]],
          willUpdate: [],
          willSkip: [],
        };
      }

      return {
        willCreate: [],
        willUpdate: [basename(existing.resolvedPath)],
        willSkip: [],
      };
    },
  };
}
