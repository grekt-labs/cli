import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "./types";
import type { InstalledYaml } from "#/schemas/index";
import { GREKTS_DIR } from "#/lib/paths";

const TARGET_DIR = ".opencode";
const TARGET_AGENTS_DIR = join(TARGET_DIR, "agents");
const TARGET_SKILLS_DIR = join(TARGET_DIR, "skills");
const TARGET_COMMANDS_DIR = join(TARGET_DIR, "commands");

function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getSafeFilename(artifactId: string, filepath: string): string {
  const safeName = artifactId.replace("@", "").replace("/", "-");
  const filename = basename(filepath);
  return `${safeName}_${filename}`;
}

export const opencodePlugin: SyncPlugin = {
  id: "opencode",
  name: "OpenCode",
  targetFile: TARGET_DIR,

  targetExists(projectRoot: string): boolean {
    return existsSync(`${projectRoot}/${TARGET_DIR}`);
  },

  async sync(installed: InstalledYaml, projectRoot: string, options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { created: [], updated: [], skipped: [] };

    if (options.dryRun) {
      const preview = this.preview(installed, projectRoot);
      return {
        created: preview.willCreate,
        updated: preview.willUpdate,
        skipped: preview.willSkip,
      };
    }

    const dirs = [TARGET_DIR, TARGET_AGENTS_DIR, TARGET_SKILLS_DIR, TARGET_COMMANDS_DIR];
    for (const dir of dirs) {
      const fullPath = `${projectRoot}/${dir}`;
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }

    for (const [artifactId, artifact] of Object.entries(installed.artifacts)) {
      const artifactDir = `${projectRoot}/${GREKTS_DIR}/${artifactId}`;

      if (artifact.agent) {
        const source = join(artifactDir, artifact.agent);
        const targetName = `${artifactId.replace("/", "-")}.md`;
        const target = `${projectRoot}/${TARGET_AGENTS_DIR}/${targetName}`;

        if (existsSync(source)) {
          ensureDir(target);
          const existed = existsSync(target);
          copyFileSync(source, target);
          if (existed) {
            result.updated.push(`${TARGET_AGENTS_DIR}/${targetName}`);
          } else {
            result.created.push(`${TARGET_AGENTS_DIR}/${targetName}`);
          }
        } else {
          result.skipped.push(`${artifactId}/agent (source not found)`);
        }
      }

      for (const skillPath of artifact.skills) {
        const source = join(artifactDir, skillPath);
        const skillName = getSafeFilename(artifactId, skillPath);
        const target = `${projectRoot}/${TARGET_SKILLS_DIR}/${skillName}`;

        if (existsSync(source)) {
          ensureDir(target);
          const existed = existsSync(target);
          copyFileSync(source, target);
          if (existed) {
            result.updated.push(`${TARGET_SKILLS_DIR}/${skillName}`);
          } else {
            result.created.push(`${TARGET_SKILLS_DIR}/${skillName}`);
          }
        } else {
          result.skipped.push(`${artifactId}/${skillPath} (source not found)`);
        }
      }

      for (const cmdPath of artifact.commands) {
        const source = join(artifactDir, cmdPath);
        const cmdName = getSafeFilename(artifactId, cmdPath);
        const target = `${projectRoot}/${TARGET_COMMANDS_DIR}/${cmdName}`;

        if (existsSync(source)) {
          ensureDir(target);
          const existed = existsSync(target);
          copyFileSync(source, target);
          if (existed) {
            result.updated.push(`${TARGET_COMMANDS_DIR}/${cmdName}`);
          } else {
            result.created.push(`${TARGET_COMMANDS_DIR}/${cmdName}`);
          }
        } else {
          result.skipped.push(`${artifactId}/${cmdPath} (source not found)`);
        }
      }
    }

    return result;
  },

  preview(installed: InstalledYaml, projectRoot: string): SyncPreview {
    const preview: SyncPreview = { willCreate: [], willUpdate: [], willSkip: [] };

    if (!existsSync(`${projectRoot}/${TARGET_DIR}`)) {
      preview.willCreate.push(TARGET_DIR);
    }

    for (const [artifactId, artifact] of Object.entries(installed.artifacts)) {
      const artifactDir = `${projectRoot}/${GREKTS_DIR}/${artifactId}`;

      if (artifact.agent) {
        const source = join(artifactDir, artifact.agent);
        const targetName = `${artifactId.replace("/", "-")}.md`;
        const target = `${projectRoot}/${TARGET_AGENTS_DIR}/${targetName}`;

        if (!existsSync(source)) {
          preview.willSkip.push(`${artifactId}/agent (source not found)`);
        } else if (existsSync(target)) {
          preview.willUpdate.push(`${TARGET_AGENTS_DIR}/${targetName}`);
        } else {
          preview.willCreate.push(`${TARGET_AGENTS_DIR}/${targetName}`);
        }
      }

      for (const skillPath of artifact.skills) {
        const source = join(artifactDir, skillPath);
        const skillName = getSafeFilename(artifactId, skillPath);
        const target = `${projectRoot}/${TARGET_SKILLS_DIR}/${skillName}`;

        if (!existsSync(source)) {
          preview.willSkip.push(`${artifactId}/${skillPath} (source not found)`);
        } else if (existsSync(target)) {
          preview.willUpdate.push(`${TARGET_SKILLS_DIR}/${skillName}`);
        } else {
          preview.willCreate.push(`${TARGET_SKILLS_DIR}/${skillName}`);
        }
      }

      for (const cmdPath of artifact.commands) {
        const source = join(artifactDir, cmdPath);
        const cmdName = getSafeFilename(artifactId, cmdPath);
        const target = `${projectRoot}/${TARGET_COMMANDS_DIR}/${cmdName}`;

        if (!existsSync(source)) {
          preview.willSkip.push(`${artifactId}/${cmdPath} (source not found)`);
        } else if (existsSync(target)) {
          preview.willUpdate.push(`${TARGET_COMMANDS_DIR}/${cmdName}`);
        } else {
          preview.willCreate.push(`${TARGET_COMMANDS_DIR}/${cmdName}`);
        }
      }
    }

    return preview;
  },
};

export default opencodePlugin;
