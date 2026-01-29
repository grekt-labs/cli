import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview, FolderPluginConfig, RulesOnlyPluginConfig } from "#/sync/sync.types";
import type { Lockfile, ProjectConfig, ArtifactMode } from "@grekt-labs/cli-engine";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getSafeFilename, GREKT_BLOCK_START, GREKT_BLOCK_END, generateDefaultBlockContent } from "@grekt-labs/cli-engine";

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
 * Create a folder-based plugin that syncs agents/skills/commands to subfolders.
 * Optionally updates a rules file (like CLAUDE.md).
 */
export function createFolderPlugin(config: FolderPluginConfig): SyncPlugin {
  const { id, name, targetDir, contextEntryPoint, generateRulesContent } = config;

  const AGENT_DIR = config.paths?.agent ?? join(targetDir, "agents");
  const SKILL_DIR = config.paths?.skill ?? join(targetDir, "skills");
  const COMMAND_DIR = config.paths?.command ?? join(targetDir, "commands");

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
      const dirs = [targetDir, AGENT_DIR, SKILL_DIR, COMMAND_DIR];
      for (const dir of dirs) {
        const fullPath = `${projectRoot}/${dir}`;
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true });
        }
      }

      // Sync each artifact (only CORE mode artifacts are copied)
      for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
        // Skip LAZY mode artifacts - they're only in the index
        if (!shouldSyncArtifact(options.projectConfig, artifactId)) {
          result.skipped.push(`${artifactId} (lazy mode)`);
          continue;
        }

        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        // Copy agent
        if (artifact.agent) {
          const source = join(artifactDir, artifact.agent);
          const targetName = `${artifactId.replace("/", "-")}.md`;
          const target = `${projectRoot}/${AGENT_DIR}/${targetName}`;

          if (existsSync(source)) {
            ensureDir(target);
            const existed = existsSync(target);
            copyFileSync(source, target);
            if (existed) {
              result.updated.push(`${AGENT_DIR}/${targetName}`);
            } else {
              result.created.push(`${AGENT_DIR}/${targetName}`);
            }
          } else {
            result.skipped.push(`${artifactId}/agent (source not found)`);
          }
        }

        // Copy skills
        for (const skillPath of artifact.skills) {
          const source = join(artifactDir, skillPath);
          const skillName = getSafeFilename(artifactId, skillPath);
          const target = `${projectRoot}/${SKILL_DIR}/${skillName}`;

          if (existsSync(source)) {
            ensureDir(target);
            const existed = existsSync(target);
            copyFileSync(source, target);
            if (existed) {
              result.updated.push(`${SKILL_DIR}/${skillName}`);
            } else {
              result.created.push(`${SKILL_DIR}/${skillName}`);
            }
          } else {
            result.skipped.push(`${artifactId}/${skillPath} (source not found)`);
          }
        }

        // Copy commands
        for (const cmdPath of artifact.commands) {
          const source = join(artifactDir, cmdPath);
          const cmdName = getSafeFilename(artifactId, cmdPath);
          const target = `${projectRoot}/${COMMAND_DIR}/${cmdName}`;

          if (existsSync(source)) {
            ensureDir(target);
            const existed = existsSync(target);
            copyFileSync(source, target);
            if (existed) {
              result.updated.push(`${COMMAND_DIR}/${cmdName}`);
            } else {
              result.created.push(`${COMMAND_DIR}/${cmdName}`);
            }
          } else {
            result.skipped.push(`${artifactId}/${cmdPath} (source not found)`);
          }
        }
      }

      // Update context entry point if configured
      updateContextEntryPoint(projectRoot, lockfile, result);

      return result;
    },

    preview(lockfile: Lockfile, projectRoot: string, options?: SyncOptions): SyncPreview {
      const preview: SyncPreview = { willCreate: [], willUpdate: [], willSkip: [] };

      if (!existsSync(`${projectRoot}/${targetDir}`)) {
        preview.willCreate.push(targetDir);
      }

      for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
        // Skip LAZY mode artifacts - they're only in the index
        if (!shouldSyncArtifact(options?.projectConfig, artifactId)) {
          preview.willSkip.push(`${artifactId} (lazy mode)`);
          continue;
        }

        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        if (artifact.agent) {
          const source = join(artifactDir, artifact.agent);
          const targetName = `${artifactId.replace("/", "-")}.md`;
          const target = `${projectRoot}/${AGENT_DIR}/${targetName}`;

          if (!existsSync(source)) {
            preview.willSkip.push(`${artifactId}/agent (source not found)`);
          } else if (existsSync(target)) {
            preview.willUpdate.push(`${AGENT_DIR}/${targetName}`);
          } else {
            preview.willCreate.push(`${AGENT_DIR}/${targetName}`);
          }
        }

        for (const skillPath of artifact.skills) {
          const source = join(artifactDir, skillPath);
          const skillName = getSafeFilename(artifactId, skillPath);
          const target = `${projectRoot}/${SKILL_DIR}/${skillName}`;

          if (!existsSync(source)) {
            preview.willSkip.push(`${artifactId}/${skillPath} (source not found)`);
          } else if (existsSync(target)) {
            preview.willUpdate.push(`${SKILL_DIR}/${skillName}`);
          } else {
            preview.willCreate.push(`${SKILL_DIR}/${skillName}`);
          }
        }

        for (const cmdPath of artifact.commands) {
          const source = join(artifactDir, cmdPath);
          const cmdName = getSafeFilename(artifactId, cmdPath);
          const target = `${projectRoot}/${COMMAND_DIR}/${cmdName}`;

          if (!existsSync(source)) {
            preview.willSkip.push(`${artifactId}/${cmdPath} (source not found)`);
          } else if (existsSync(target)) {
            preview.willUpdate.push(`${COMMAND_DIR}/${cmdName}`);
          } else {
            preview.willCreate.push(`${COMMAND_DIR}/${cmdName}`);
          }
        }
      }

      // Context entry point preview
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
