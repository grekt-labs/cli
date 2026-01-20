import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "./types";
import type { InstalledYaml } from "#/schemas/index";
import { GREKTS_DIR } from "#/lib/paths";

// Target paths (where artifacts sync to)
const TARGET_DIR = ".claude";
const TARGET_AGENTS_DIR = join(TARGET_DIR, "agents");
const TARGET_SKILLS_DIR = join(TARGET_DIR, "skills");
const TARGET_COMMANDS_DIR = join(TARGET_DIR, "commands");
const TARGET_README = join(TARGET_DIR, "CLAUDE.md");

const GREKT_BLOCK_START = "<!-- GREKT -->";
const GREKT_BLOCK_END = "<!-- /GREKT -->";

function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create a namespaced filename to avoid collisions between artifacts.
 * @example getSafeFilename("@grekt/testing-helper", "skills/analyze.md")
 *          → "grekt-testing-helper_analyze.md"
 */
function getSafeFilename(artifactId: string, filepath: string): string {
  const safeName = artifactId.replace("@", "").replace("/", "-");
  const filename = basename(filepath);
  return `${safeName}_${filename}`;
}

function updateReadme(projectRoot: string, installed: InstalledYaml, result: SyncResult): void {
  const filepath = `${projectRoot}/${TARGET_README}`;
  const grektBlock = generateGrektBlock(installed);

  if (!existsSync(filepath)) {
    ensureDir(filepath);
    writeFileSync(filepath, grektBlock, "utf-8");
    result.created.push(TARGET_README);
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
  result.updated.push(TARGET_README);
}

function generateGrektBlock(installed: InstalledYaml): string {
  const artifacts = Object.keys(installed.artifacts);

  let content = `${GREKT_BLOCK_START}\n`;
  content += `Grekt artifacts installed. See \`${GREKTS_DIR}/installed.yaml\` for details.\n`;

  if (artifacts.length > 0) {
    content += `\nArtifacts: ${artifacts.join(", ")}\n`;
  }

  content += `${GREKT_BLOCK_END}`;
  return content;
}

export const claudePlugin: SyncPlugin = {
  id: "claude",
  name: "Claude",
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

    // Create target directories
    const dirs = [TARGET_DIR, TARGET_AGENTS_DIR, TARGET_SKILLS_DIR, TARGET_COMMANDS_DIR];
    for (const dir of dirs) {
      const fullPath = `${projectRoot}/${dir}`;
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }

    // Sync each artifact
    for (const [artifactId, artifact] of Object.entries(installed.artifacts)) {
      const artifactDir = `${projectRoot}/${GREKTS_DIR}/${artifactId}`;

      // Copy agent
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

      // Copy skills (with namespacing to avoid collisions)
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

      // Copy commands (with namespacing to avoid collisions)
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

    // Update readme
    updateReadme(projectRoot, installed, result);

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

    if (!existsSync(`${projectRoot}/${TARGET_README}`)) {
      preview.willCreate.push(TARGET_README);
    } else {
      preview.willUpdate.push(TARGET_README);
    }

    return preview;
  },
};

export default claudePlugin;
