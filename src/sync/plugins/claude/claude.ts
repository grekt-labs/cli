import { basename } from "path";
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { toSafeName } from "@grekt-labs/cli-engine";

const TARGET_DIR = ".claude";
const ENTRY_POINTS = [`${TARGET_DIR}/CLAUDE.md`, "CLAUDE.md"];

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
});

export default claudePlugin;
