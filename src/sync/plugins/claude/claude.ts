import { basename, join } from "path";
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { toSafeName, resolveComponentFilename, getSkillRouterTemplate } from "@grekt/engine";
import { fs } from "#/context";
import { copySiblingFiles } from "#/sync/helpers/siblings";

const TARGET_DIR = ".claude";
const ENTRY_POINTS = [join(TARGET_DIR, "CLAUDE.md"), "CLAUDE.md"];
const SKILL_ROUTER_PATH = join(TARGET_DIR, "skills", "grekt", "SKILL.md");

const SKILL_ROUTER_FRONTMATTER = `---
name: grekt
description: Search and load grekt artifact skills by name or intent
argument-hint: "skill <name> | <question>"
allowed-tools: Bash, Read, AskUserQuestion
---`;

function buildSkillRouterContent(): string {
  return `${SKILL_ROUTER_FRONTMATTER}\n\n${getSkillRouterTemplate()}`;
}

function getSkillFolderName(artifactId: string, filePath: string): string {
  const safeName = toSafeName(artifactId);
  const skillName = basename(resolveComponentFilename(filePath), ".md");
  return `${safeName}-${skillName}`;
}

export const claudePlugin = createFolderPlugin({
  id: "claude",
  name: "Claude",
  targetDir: TARGET_DIR,
  entryPoints: ENTRY_POINTS,
  generateRulesContent: generateDefaultBlockContent,
  getTargetPath: (artifactId, category, filePath) => {
    if (category === "skills") {
      const folderName = getSkillFolderName(artifactId, filePath);
      return `${folderName}/SKILL.md`;
    }
    if (category === "agents") {
      const safeName = toSafeName(artifactId);
      const agentFilename = resolveComponentFilename(filePath);
      return `${safeName}_${agentFilename}`;
    }
    return null;
  },
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    const skillRouterFile = join(projectRoot, SKILL_ROUTER_PATH);

    ensureDir(skillRouterFile);
    fs.writeFile(skillRouterFile, buildSkillRouterContent());
  },
});

export default claudePlugin;

// MCP distribution config for Claude Code (.mcp.json)
export { claudeMcpConfig } from "./claude.mcp";
