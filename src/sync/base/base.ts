import { basename, dirname, join } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview, FolderPluginConfig, RulesOnlyPluginConfig } from "#/sync/sync.types";
import {
  type Lockfile,
  type ProjectConfig,
  type ArtifactMode,
  type Category,
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
function findEntryPointPath(projectRoot: string, entryPoint: string): string {
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
export type { FolderPluginConfig, RulesOnlyPluginConfig } from "@grekt-labs/cli-engine";

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
 * Create a folder-based plugin that syncs artifacts to category subfolders.
 * Optionally updates a rules file (like CLAUDE.md).
 */
export function createFolderPlugin(config: FolderPluginConfig): SyncPlugin {
  const { id, name, targetDir, contextEntryPoint, generateRulesContent } = config;

  // Build category paths from config or defaults
  function getCategoryDir(category: Category): string {
    return config.paths?.[category] ?? join(targetDir, CATEGORY_CONFIG[category].defaultPath);
  }

  function updateContextEntryPoint(projectRoot: string, lockfile: Lockfile, result: SyncResult): void {
    if (!contextEntryPoint || !generateRulesContent) return;

    const filepath = findEntryPointPath(projectRoot, contextEntryPoint);
    const managedBlock = generateRulesContent(lockfile);

    if (!fs.exists(filepath)) {
      ensureDir(filepath);
      fs.writeFile(filepath, managedBlock + "\n");
      result.created.push(contextEntryPoint);
      return;
    }

    const content = fs.readFile(filepath);

    // If section header already exists, nothing to do
    if (content.includes(GREKT_SECTION_HEADER)) {
      return;
    }

    // Prepend to file
    fs.writeFile(filepath, managedBlock + "\n\n" + content.trimStart());
    result.updated.push(basename(filepath));
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

    targetExists(projectRoot: string): boolean {
      return fs.exists(`${projectRoot}/${targetDir}`);
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

      if (contextEntryPoint) {
        const entryPath = findEntryPointPath(projectRoot, contextEntryPoint);
        if (!fs.exists(entryPath)) {
          preview.willCreate.push(contextEntryPoint);
        } else {
          preview.willUpdate.push(basename(entryPath));
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
  const { id, name, contextEntryPoint, generateRulesContent } = config;

  return {
    id,
    name,
    targetFile: contextEntryPoint,

    targetExists(projectRoot: string): boolean {
      const filepath = findEntryPointPath(projectRoot, contextEntryPoint);
      return fs.exists(filepath);
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

      const filepath = findEntryPointPath(projectRoot, contextEntryPoint);
      const managedBlock = generateRulesContent(lockfile);

      if (!fs.exists(filepath)) {
        if (!options.createTarget) {
          result.skipped.push(`${contextEntryPoint} (file doesn't exist)`);
          return result;
        }
        ensureDir(filepath);
        fs.writeFile(filepath, managedBlock);
        result.created.push(contextEntryPoint);
        return result;
      }

      const content = fs.readFile(filepath);

      // If section header already exists, nothing to do
      if (content.includes(GREKT_SECTION_HEADER)) {
        return result;
      }

      // Prepend to file
      fs.writeFile(filepath, managedBlock + "\n\n" + content.trimStart());
      result.updated.push(basename(filepath));
      return result;
    },

    preview(_lockfile: Lockfile, projectRoot: string, _options?: SyncOptions): SyncPreview {
      const filepath = findEntryPointPath(projectRoot, contextEntryPoint);

      if (!fs.exists(filepath)) {
        return {
          willCreate: [contextEntryPoint],
          willUpdate: [],
          willSkip: [],
        };
      }

      return {
        willCreate: [],
        willUpdate: [basename(filepath)],
        willSkip: [],
      };
    },
  };
}
