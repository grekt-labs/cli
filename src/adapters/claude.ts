import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname } from "path";
import type { SyncAdapter, SyncResult, SyncOptions, SyncPreview } from "./interface.js";
import type { InstalledYaml } from "../schemas/index.js";
import {
  CLAUDE_DIR,
  CLAUDE_AGENTS_DIR,
  CLAUDE_SKILLS_DIR,
  CLAUDE_MD,
  AGENTS_DIR,
  SKILLS_DIR,
} from "../lib/paths.js";

const GREKT_BLOCK_START = "<!-- GREKT -->";
const GREKT_BLOCK_END = "<!-- /GREKT -->";

export const claudeAdapter: SyncAdapter = {
  name: "Claude",
  targetFile: CLAUDE_DIR,

  targetExists(projectRoot: string): boolean {
    return existsSync(`${projectRoot}/${CLAUDE_DIR}`);
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

    // Create .claude directories
    const dirs = [CLAUDE_DIR, CLAUDE_AGENTS_DIR, CLAUDE_SKILLS_DIR];
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
      const target = `${projectRoot}/${CLAUDE_AGENTS_DIR}/${agent.file}`;

      if (existsSync(source)) {
        ensureDir(target);
        copyFileSync(source, target);
        if (existsSync(target)) {
          result.updated.push(`${CLAUDE_AGENTS_DIR}/${agent.file}`);
        } else {
          result.created.push(`${CLAUDE_AGENTS_DIR}/${agent.file}`);
        }
      } else {
        result.skipped.push(`${name} (source not found)`);
      }
    }

    // Copy skills
    for (const [name, skill] of Object.entries(installed.skills)) {
      const source = `${projectRoot}/${SKILLS_DIR}/${skill.file}`;
      const target = `${projectRoot}/${CLAUDE_SKILLS_DIR}/${skill.file}`;

      if (existsSync(source)) {
        ensureDir(target);
        copyFileSync(source, target);
        if (existsSync(target)) {
          result.updated.push(`${CLAUDE_SKILLS_DIR}/${skill.file}`);
        } else {
          result.created.push(`${CLAUDE_SKILLS_DIR}/${skill.file}`);
        }
      } else {
        result.skipped.push(`${name} (source not found)`);
      }
    }

    // Update CLAUDE.md
    updateClaudeMd(projectRoot, installed, result);

    return result;
  },

  preview(installed: InstalledYaml, projectRoot: string): SyncPreview {
    const preview: SyncPreview = { willCreate: [], willUpdate: [], willSkip: [] };

    // Check directories
    if (!existsSync(`${projectRoot}/${CLAUDE_DIR}`)) {
      preview.willCreate.push(CLAUDE_DIR);
    }

    // Check agents
    for (const [name, agent] of Object.entries(installed.agents)) {
      const source = `${projectRoot}/${AGENTS_DIR}/${agent.file}`;
      const target = `${projectRoot}/${CLAUDE_AGENTS_DIR}/${agent.file}`;

      if (!existsSync(source)) {
        preview.willSkip.push(`${name} (source not found)`);
      } else if (existsSync(target)) {
        preview.willUpdate.push(`${CLAUDE_AGENTS_DIR}/${agent.file}`);
      } else {
        preview.willCreate.push(`${CLAUDE_AGENTS_DIR}/${agent.file}`);
      }
    }

    // Check skills
    for (const [name, skill] of Object.entries(installed.skills)) {
      const source = `${projectRoot}/${SKILLS_DIR}/${skill.file}`;
      const target = `${projectRoot}/${CLAUDE_SKILLS_DIR}/${skill.file}`;

      if (!existsSync(source)) {
        preview.willSkip.push(`${name} (source not found)`);
      } else if (existsSync(target)) {
        preview.willUpdate.push(`${CLAUDE_SKILLS_DIR}/${skill.file}`);
      } else {
        preview.willCreate.push(`${CLAUDE_SKILLS_DIR}/${skill.file}`);
      }
    }

    // CLAUDE.md
    if (!existsSync(`${projectRoot}/${CLAUDE_MD}`)) {
      preview.willCreate.push(CLAUDE_MD);
    } else {
      preview.willUpdate.push(CLAUDE_MD);
    }

    return preview;
  },
};

function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function updateClaudeMd(projectRoot: string, installed: InstalledYaml, result: SyncResult): void {
  const filepath = `${projectRoot}/${CLAUDE_MD}`;
  const grektBlock = generateGrektBlock(installed);

  if (!existsSync(filepath)) {
    // Create new file
    writeFileSync(filepath, grektBlock, "utf-8");
    result.created.push(CLAUDE_MD);
    return;
  }

  // Update existing file
  let content = readFileSync(filepath, "utf-8");
  const startIndex = content.indexOf(GREKT_BLOCK_START);
  const endIndex = content.indexOf(GREKT_BLOCK_END);

  if (startIndex !== -1 && endIndex !== -1) {
    // Replace existing block
    content = content.slice(0, startIndex) + grektBlock + content.slice(endIndex + GREKT_BLOCK_END.length);
  } else {
    // Append block
    content = content.trimEnd() + "\n\n" + grektBlock;
  }

  writeFileSync(filepath, content, "utf-8");
  result.updated.push(CLAUDE_MD);
}

function generateGrektBlock(installed: InstalledYaml): string {
  const agents = Object.keys(installed.agents);
  const skills = Object.keys(installed.skills);

  let content = `${GREKT_BLOCK_START}\n`;
  content += `Grekts synced. See .claude/agents/ and .claude/skills/\n`;

  if (agents.length > 0) {
    content += `\nAgents: ${agents.join(", ")}\n`;
  }
  if (skills.length > 0) {
    content += `Skills: ${skills.join(", ")}\n`;
  }

  content += `${GREKT_BLOCK_END}`;
  return content;
}
