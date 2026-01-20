import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "./types";
import type { Lockfile } from "#/schemas/index";
import { ARTIFACTS_DIR } from "#/lib/paths";

// Shared constants
export const GREKT_BLOCK_START = "<!-- GREKT -->";
export const GREKT_BLOCK_END = "<!-- /GREKT -->";

// Utility functions
export function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create a namespaced filename to avoid collisions between artifacts.
 * @example getSafeFilename("my-artifact", "skills/analyze.md") → "my-artifact_analyze.md"
 */
export function getSafeFilename(artifactId: string, filepath: string): string {
  const safeName = artifactId.replace("@", "").replace("/", "-");
  const filename = basename(filepath);
  return `${safeName}_${filename}`;
}

// Plugin configuration types
export interface FolderPluginConfig {
  id: string;
  name: string;
  targetDir: string;
  rulesFile?: string;
  generateRulesContent?: (lockfile: Lockfile) => string;
}

export interface RulesOnlyPluginConfig {
  id: string;
  name: string;
  rulesFile: string;
  generateRulesContent: (lockfile: Lockfile) => string;
}

/**
 * Create a folder-based plugin that syncs agents/skills/commands to subfolders.
 * Optionally updates a rules file (like CLAUDE.md).
 */
export function createFolderPlugin(config: FolderPluginConfig): SyncPlugin {
  const { id, name, targetDir, rulesFile, generateRulesContent } = config;

  const AGENTS_DIR = join(targetDir, "agents");
  const SKILLS_DIR = join(targetDir, "skills");
  const COMMANDS_DIR = join(targetDir, "commands");

  function updateRulesFile(projectRoot: string, lockfile: Lockfile, result: SyncResult): void {
    if (!rulesFile || !generateRulesContent) return;

    const filepath = `${projectRoot}/${rulesFile}`;
    const grektBlock = generateRulesContent(lockfile);

    if (!existsSync(filepath)) {
      ensureDir(filepath);
      writeFileSync(filepath, grektBlock, "utf-8");
      result.created.push(rulesFile);
      return;
    }

    let content = readFileSync(filepath, "utf-8");
    const startIndex = content.indexOf(GREKT_BLOCK_START);
    const endIndex = content.indexOf(GREKT_BLOCK_END);

    if (startIndex !== -1 && endIndex !== -1) {
      content = content.slice(0, startIndex) + grektBlock + content.slice(endIndex + GREKT_BLOCK_END.length);
    } else {
      content = content.trimEnd() + "\n\n" + grektBlock;
    }

    writeFileSync(filepath, content, "utf-8");
    result.updated.push(rulesFile);
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
      const dirs = [targetDir, AGENTS_DIR, SKILLS_DIR, COMMANDS_DIR];
      for (const dir of dirs) {
        const fullPath = `${projectRoot}/${dir}`;
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true });
        }
      }

      // Sync each artifact
      for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        // Copy agent
        if (artifact.agent) {
          const source = join(artifactDir, artifact.agent);
          const targetName = `${artifactId.replace("/", "-")}.md`;
          const target = `${projectRoot}/${AGENTS_DIR}/${targetName}`;

          if (existsSync(source)) {
            ensureDir(target);
            const existed = existsSync(target);
            copyFileSync(source, target);
            if (existed) {
              result.updated.push(`${AGENTS_DIR}/${targetName}`);
            } else {
              result.created.push(`${AGENTS_DIR}/${targetName}`);
            }
          } else {
            result.skipped.push(`${artifactId}/agent (source not found)`);
          }
        }

        // Copy skills
        for (const skillPath of artifact.skills) {
          const source = join(artifactDir, skillPath);
          const skillName = getSafeFilename(artifactId, skillPath);
          const target = `${projectRoot}/${SKILLS_DIR}/${skillName}`;

          if (existsSync(source)) {
            ensureDir(target);
            const existed = existsSync(target);
            copyFileSync(source, target);
            if (existed) {
              result.updated.push(`${SKILLS_DIR}/${skillName}`);
            } else {
              result.created.push(`${SKILLS_DIR}/${skillName}`);
            }
          } else {
            result.skipped.push(`${artifactId}/${skillPath} (source not found)`);
          }
        }

        // Copy commands
        for (const cmdPath of artifact.commands) {
          const source = join(artifactDir, cmdPath);
          const cmdName = getSafeFilename(artifactId, cmdPath);
          const target = `${projectRoot}/${COMMANDS_DIR}/${cmdName}`;

          if (existsSync(source)) {
            ensureDir(target);
            const existed = existsSync(target);
            copyFileSync(source, target);
            if (existed) {
              result.updated.push(`${COMMANDS_DIR}/${cmdName}`);
            } else {
              result.created.push(`${COMMANDS_DIR}/${cmdName}`);
            }
          } else {
            result.skipped.push(`${artifactId}/${cmdPath} (source not found)`);
          }
        }
      }

      // Update rules file if configured
      updateRulesFile(projectRoot, lockfile, result);

      return result;
    },

    preview(lockfile: Lockfile, projectRoot: string): SyncPreview {
      const preview: SyncPreview = { willCreate: [], willUpdate: [], willSkip: [] };

      if (!existsSync(`${projectRoot}/${targetDir}`)) {
        preview.willCreate.push(targetDir);
      }

      for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
        const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;

        if (artifact.agent) {
          const source = join(artifactDir, artifact.agent);
          const targetName = `${artifactId.replace("/", "-")}.md`;
          const target = `${projectRoot}/${AGENTS_DIR}/${targetName}`;

          if (!existsSync(source)) {
            preview.willSkip.push(`${artifactId}/agent (source not found)`);
          } else if (existsSync(target)) {
            preview.willUpdate.push(`${AGENTS_DIR}/${targetName}`);
          } else {
            preview.willCreate.push(`${AGENTS_DIR}/${targetName}`);
          }
        }

        for (const skillPath of artifact.skills) {
          const source = join(artifactDir, skillPath);
          const skillName = getSafeFilename(artifactId, skillPath);
          const target = `${projectRoot}/${SKILLS_DIR}/${skillName}`;

          if (!existsSync(source)) {
            preview.willSkip.push(`${artifactId}/${skillPath} (source not found)`);
          } else if (existsSync(target)) {
            preview.willUpdate.push(`${SKILLS_DIR}/${skillName}`);
          } else {
            preview.willCreate.push(`${SKILLS_DIR}/${skillName}`);
          }
        }

        for (const cmdPath of artifact.commands) {
          const source = join(artifactDir, cmdPath);
          const cmdName = getSafeFilename(artifactId, cmdPath);
          const target = `${projectRoot}/${COMMANDS_DIR}/${cmdName}`;

          if (!existsSync(source)) {
            preview.willSkip.push(`${artifactId}/${cmdPath} (source not found)`);
          } else if (existsSync(target)) {
            preview.willUpdate.push(`${COMMANDS_DIR}/${cmdName}`);
          } else {
            preview.willCreate.push(`${COMMANDS_DIR}/${cmdName}`);
          }
        }
      }

      // Rules file preview
      if (rulesFile) {
        if (!existsSync(`${projectRoot}/${rulesFile}`)) {
          preview.willCreate.push(rulesFile);
        } else {
          preview.willUpdate.push(rulesFile);
        }
      }

      return preview;
    },
  };
}

/**
 * Create a rules-only plugin that only updates a rules file (no folder sync).
 */
export function createRulesOnlyPlugin(config: RulesOnlyPluginConfig): SyncPlugin {
  const { id, name, rulesFile, generateRulesContent } = config;

  return {
    id,
    name,
    targetFile: rulesFile,

    targetExists(projectRoot: string): boolean {
      return existsSync(`${projectRoot}/${rulesFile}`);
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

      const filepath = `${projectRoot}/${rulesFile}`;
      const grektBlock = generateRulesContent(lockfile);

      if (!existsSync(filepath)) {
        if (!options.createTarget) {
          result.skipped.push(`${rulesFile} (file doesn't exist)`);
          return result;
        }
        writeFileSync(filepath, grektBlock, "utf-8");
        result.created.push(rulesFile);
        return result;
      }

      let content = readFileSync(filepath, "utf-8");
      const startIndex = content.indexOf(GREKT_BLOCK_START);
      const endIndex = content.indexOf(GREKT_BLOCK_END);

      if (startIndex !== -1 && endIndex !== -1) {
        content = content.slice(0, startIndex) + grektBlock + content.slice(endIndex + GREKT_BLOCK_END.length);
      } else {
        content = content.trimEnd() + "\n\n" + grektBlock;
      }

      writeFileSync(filepath, content, "utf-8");
      result.updated.push(rulesFile);
      return result;
    },

    preview(_lockfile: Lockfile, projectRoot: string): SyncPreview {
      const filepath = `${projectRoot}/${rulesFile}`;

      if (!existsSync(filepath)) {
        return {
          willCreate: [rulesFile],
          willUpdate: [],
          willSkip: [],
        };
      }

      return {
        willCreate: [],
        willUpdate: [rulesFile],
        willSkip: [],
      };
    },
  };
}
