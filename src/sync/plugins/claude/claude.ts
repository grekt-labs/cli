import { basename } from "path";
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { toSafeName, getSkillRouterTemplate } from "@grekt-labs/cli-engine";
import { fs } from "#/context";
import { copySiblingFiles } from "#/sync/helpers/siblings";

const TARGET_DIR = ".claude";
const ENTRY_POINTS = [`${TARGET_DIR}/CLAUDE.md`, "CLAUDE.md"];
const SKILL_ROUTER_PATH = `${TARGET_DIR}/skills/grekt/SKILL.md`;

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
  const skillName = basename(filePath, ".md");
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
    return null;
  },
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    const skillRouterFile = `${projectRoot}/${SKILL_ROUTER_PATH}`;

    if (fs.exists(skillRouterFile)) return;

    ensureDir(skillRouterFile);
    fs.writeFile(skillRouterFile, buildSkillRouterContent());
  },
});

export default claudePlugin;
