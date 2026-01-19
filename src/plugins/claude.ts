import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "./types";
import type { InstalledYaml } from "#/schemas/index";
import { GREKTS_DIR } from "#/lib/paths";

// Target paths (where packages sync to)
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
  const packages = Object.keys(installed.packages);

  let content = `${GREKT_BLOCK_START}\n`;
  content += `Grekt packages installed. See \`${GREKTS_DIR}/installed.yaml\` for details.\n`;

  if (packages.length > 0) {
    content += `\nPackages: ${packages.join(", ")}\n`;
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

    // Sync each package
    for (const [packageId, pkg] of Object.entries(installed.packages)) {
      const packageDir = `${projectRoot}/${GREKTS_DIR}/${packageId}`;

      // Copy agent
      if (pkg.agent) {
        const source = join(packageDir, pkg.agent);
        const targetName = `${packageId.replace("/", "-")}.md`;
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
          result.skipped.push(`${packageId}/agent (source not found)`);
        }
      }

      // Copy skills
      for (const skillPath of pkg.skills) {
        const source = join(packageDir, skillPath);
        const skillName = basename(skillPath);
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
          result.skipped.push(`${packageId}/${skillPath} (source not found)`);
        }
      }

      // Copy commands
      for (const cmdPath of pkg.commands) {
        const source = join(packageDir, cmdPath);
        const cmdName = basename(cmdPath);
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
          result.skipped.push(`${packageId}/${cmdPath} (source not found)`);
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

    for (const [packageId, pkg] of Object.entries(installed.packages)) {
      const packageDir = `${projectRoot}/${GREKTS_DIR}/${packageId}`;

      if (pkg.agent) {
        const source = join(packageDir, pkg.agent);
        const targetName = `${packageId.replace("/", "-")}.md`;
        const target = `${projectRoot}/${TARGET_AGENTS_DIR}/${targetName}`;

        if (!existsSync(source)) {
          preview.willSkip.push(`${packageId}/agent (source not found)`);
        } else if (existsSync(target)) {
          preview.willUpdate.push(`${TARGET_AGENTS_DIR}/${targetName}`);
        } else {
          preview.willCreate.push(`${TARGET_AGENTS_DIR}/${targetName}`);
        }
      }

      for (const skillPath of pkg.skills) {
        const source = join(packageDir, skillPath);
        const skillName = basename(skillPath);
        const target = `${projectRoot}/${TARGET_SKILLS_DIR}/${skillName}`;

        if (!existsSync(source)) {
          preview.willSkip.push(`${packageId}/${skillPath} (source not found)`);
        } else if (existsSync(target)) {
          preview.willUpdate.push(`${TARGET_SKILLS_DIR}/${skillName}`);
        } else {
          preview.willCreate.push(`${TARGET_SKILLS_DIR}/${skillName}`);
        }
      }

      for (const cmdPath of pkg.commands) {
        const source = join(packageDir, cmdPath);
        const cmdName = basename(cmdPath);
        const target = `${projectRoot}/${TARGET_COMMANDS_DIR}/${cmdName}`;

        if (!existsSync(source)) {
          preview.willSkip.push(`${packageId}/${cmdPath} (source not found)`);
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
