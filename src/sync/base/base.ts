import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview, FolderPluginConfig, RulesOnlyPluginConfig } from "#/sync/sync.types";
import {
  type Lockfile,
  type ProjectConfig,
  type ArtifactMode,
  type Category,
  CATEGORIES,
  CATEGORY_CONFIG,
  getCategoriesForFormat,
} from "@grekt-labs/cli-engine";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getSafeFilename, GREKT_BLOCK_START, GREKT_BLOCK_END, generateDefaultBlockContent } from "@grekt-labs/cli-engine";

// MD categories can be synced to folder targets
const SYNCABLE_CATEGORIES = getCategoriesForFormat("md");

// Re-export for external use
export { GREKT_BLOCK_START, GREKT_BLOCK_END, generateDefaultBlockContent } from "@grekt-labs/cli-engine";

// Utility functions
export function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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

    const filepath = `${projectRoot}/${contextEntryPoint}`;
    const managedBlock = generateRulesContent(lockfile);

    if (!existsSync(filepath)) {
      ensureDir(filepath);
      writeFileSync(filepath, managedBlock, "utf-8");
      result.created.push(contextEntryPoint);
      return;
    }

    let content = readFileSync(filepath, "utf-8");
    const startIndex = content.indexOf(GREKT_BLOCK_START);
    const endIndex = content.indexOf(GREKT_BLOCK_END);

    if (startIndex !== -1 && endIndex !== -1) {
      content = content.slice(0, startIndex) + managedBlock + content.slice(endIndex + GREKT_BLOCK_END.length);
    } else {
      content = managedBlock + "\n" + content.trimStart();
    }

    writeFileSync(filepath, content, "utf-8");
    result.updated.push(contextEntryPoint);
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
      return existsSync(`${projectRoot}/${targetDir}`);
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
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true });
        }
      }

      // Sync each artifact (only CORE mode artifacts are copied)
      for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
        if (!shouldSyncArtifact(options.projectConfig, artifactId)) {
          result.skipped.push(`${artifactId} (lazy mode)`);
          continue;
        }

        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        // Copy files for each syncable category
        for (const category of SYNCABLE_CATEGORIES) {
          const categoryDir = getCategoryDir(category);
          const files = artifact[category];

          if (!files || files.length === 0) continue;

          for (const filePath of files) {
            const source = join(artifactDir, filePath);
            const targetName = getTargetPath(artifactId, category, filePath);
            const target = `${projectRoot}/${categoryDir}/${targetName}`;

            if (existsSync(source)) {
              ensureDir(target);
              const existed = existsSync(target);
              copyFileSync(source, target);
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

      if (!existsSync(`${projectRoot}/${targetDir}`)) {
        preview.willCreate.push(targetDir);
      }

      for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
        if (!shouldSyncArtifact(options?.projectConfig, artifactId)) {
          preview.willSkip.push(`${artifactId} (lazy mode)`);
          continue;
        }

        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        for (const category of SYNCABLE_CATEGORIES) {
          const categoryDir = getCategoryDir(category);
          const files = artifact[category];

          if (!files || files.length === 0) continue;

          for (const filePath of files) {
            const source = join(artifactDir, filePath);
            const targetName = getTargetPath(artifactId, category, filePath);
            const target = `${projectRoot}/${categoryDir}/${targetName}`;

            if (!existsSync(source)) {
              preview.willSkip.push(`${artifactId}/${filePath} (source not found)`);
            } else if (existsSync(target)) {
              preview.willUpdate.push(`${categoryDir}/${targetName}`);
            } else {
              preview.willCreate.push(`${categoryDir}/${targetName}`);
            }
          }
        }
      }

      if (contextEntryPoint) {
        if (!existsSync(`${projectRoot}/${contextEntryPoint}`)) {
          preview.willCreate.push(contextEntryPoint);
        } else {
          preview.willUpdate.push(contextEntryPoint);
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
      return existsSync(`${projectRoot}/${contextEntryPoint}`);
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

      const filepath = `${projectRoot}/${contextEntryPoint}`;
      const managedBlock = generateRulesContent(lockfile);

      if (!existsSync(filepath)) {
        if (!options.createTarget) {
          result.skipped.push(`${contextEntryPoint} (file doesn't exist)`);
          return result;
        }
        writeFileSync(filepath, managedBlock, "utf-8");
        result.created.push(contextEntryPoint);
        return result;
      }

      let content = readFileSync(filepath, "utf-8");
      const startIndex = content.indexOf(GREKT_BLOCK_START);
      const endIndex = content.indexOf(GREKT_BLOCK_END);

      if (startIndex !== -1 && endIndex !== -1) {
        content = content.slice(0, startIndex) + managedBlock + content.slice(endIndex + GREKT_BLOCK_END.length);
      } else {
        content = managedBlock + "\n" + content.trimStart();
      }

      writeFileSync(filepath, content, "utf-8");
      result.updated.push(contextEntryPoint);
      return result;
    },

    preview(_lockfile: Lockfile, projectRoot: string, _options?: SyncOptions): SyncPreview {
      const filepath = `${projectRoot}/${contextEntryPoint}`;

      if (!existsSync(filepath)) {
        return {
          willCreate: [contextEntryPoint],
          willUpdate: [],
          willSkip: [],
        };
      }

      return {
        willCreate: [],
        willUpdate: [contextEntryPoint],
        willSkip: [],
      };
    },
  };
}
