import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "./types";
import type { InstalledYaml } from "#/schemas/index";
import { AGENTS_DIR, SKILLS_DIR } from "#/lib/paths";

// Target paths (where artifacts sync to)
const TARGET_DIR = ".claude";
const TARGET_AGENTS_DIR = join(TARGET_DIR, "agents");
const TARGET_SKILLS_DIR = join(TARGET_DIR, "skills");
const TARGET_README = join(TARGET_DIR, "CLAUDE.md");

const GREKT_BLOCK_START = "<!-- GREKT -->";
const GREKT_BLOCK_END = "<!-- /GREKT -->";

function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function updateReadme(projectRoot: string, installed: InstalledYaml, result: SyncResult): void {
  const filepath = `${projectRoot}/${TARGET_README}`;
  const grektBlock = generateGrektBlock(installed);

  if (!existsSync(filepath)) {
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
  const agents = Object.keys(installed.agents);
  const skills = Object.keys(installed.skills);

  let content = `${GREKT_BLOCK_START}\n`;
  content += `Grekts synced. See ${TARGET_AGENTS_DIR}/ and ${TARGET_SKILLS_DIR}/\n`;

  if (agents.length > 0) {
    content += `\nAgents: ${agents.join(", ")}\n`;
  }
  if (skills.length > 0) {
    content += `Skills: ${skills.join(", ")}\n`;
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
    const dirs = [TARGET_DIR, TARGET_AGENTS_DIR, TARGET_SKILLS_DIR];
    for (const dir of dirs) {
      const fullPath = `${projectRoot}/${dir}`;
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
        result.created.push(dir);
      }
    }

    // Copy agents
    for (const [name, agent] of Object.entries(installed.agents)) {
      const source = `${projectRoot}/${AGENTS_DIR}/${agent.file}`;
      const target = `${projectRoot}/${TARGET_AGENTS_DIR}/${agent.file}`;

      if (existsSync(source)) {
        ensureDir(target);
        const existed = existsSync(target);
        copyFileSync(source, target);
        if (existed) {
          result.updated.push(`${TARGET_AGENTS_DIR}/${agent.file}`);
        } else {
          result.created.push(`${TARGET_AGENTS_DIR}/${agent.file}`);
        }
      } else {
        result.skipped.push(`${name} (source not found)`);
      }
    }

    // Copy skills
    for (const [name, skill] of Object.entries(installed.skills)) {
      const source = `${projectRoot}/${SKILLS_DIR}/${skill.file}`;
      const target = `${projectRoot}/${TARGET_SKILLS_DIR}/${skill.file}`;

      if (existsSync(source)) {
        ensureDir(target);
        const existed = existsSync(target);
        copyFileSync(source, target);
        if (existed) {
          result.updated.push(`${TARGET_SKILLS_DIR}/${skill.file}`);
        } else {
          result.created.push(`${TARGET_SKILLS_DIR}/${skill.file}`);
        }
      } else {
        result.skipped.push(`${name} (source not found)`);
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

    for (const [name, agent] of Object.entries(installed.agents)) {
      const source = `${projectRoot}/${AGENTS_DIR}/${agent.file}`;
      const target = `${projectRoot}/${TARGET_AGENTS_DIR}/${agent.file}`;

      if (!existsSync(source)) {
        preview.willSkip.push(`${name} (source not found)`);
      } else if (existsSync(target)) {
        preview.willUpdate.push(`${TARGET_AGENTS_DIR}/${agent.file}`);
      } else {
        preview.willCreate.push(`${TARGET_AGENTS_DIR}/${agent.file}`);
      }
    }

    for (const [name, skill] of Object.entries(installed.skills)) {
      const source = `${projectRoot}/${SKILLS_DIR}/${skill.file}`;
      const target = `${projectRoot}/${TARGET_SKILLS_DIR}/${skill.file}`;

      if (!existsSync(source)) {
        preview.willSkip.push(`${name} (source not found)`);
      } else if (existsSync(target)) {
        preview.willUpdate.push(`${TARGET_SKILLS_DIR}/${skill.file}`);
      } else {
        preview.willCreate.push(`${TARGET_SKILLS_DIR}/${skill.file}`);
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
