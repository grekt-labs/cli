import { basename, join } from "path";
import matter from "gray-matter";
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { toSafeName, resolveComponentFilename } from "@grekt/engine";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".kiro";
const STEERING_DIR = join(TARGET_DIR, "steering");
const ENTRY_POINTS = [join(STEERING_DIR, "grekt.md")];

/**
 * Claude-specific frontmatter fields that have no meaning in Kiro.
 * Kiro uses its own frontmatter (inclusion, fileMatchPattern).
 */
const CLAUDE_SPECIFIC_FIELDS = [
  "argument-hint",
  "disable-model-invocation",
  "user-invocable",
  "model",
  "context",
  "agent",
  "hooks",
  "allowed-tools",
];

/**
 * Transform grekt frontmatter to Kiro-native format.
 *
 * Kiro skills use `name` and `description` (same as agentskills.io).
 * Claude-specific fields are stripped.
 */
function transformToKiroFormat(content: string): string {
  const { data, content: body } = matter(content);

  const transformed: Record<string, unknown> = {};

  transformed["name"] = data["name"] ?? data["grk-name"];
  transformed["description"] = data["description"] ?? data["grk-description"];

  // grk-type always stays (grekt needs it for scanning)
  transformed["grk-type"] = data["grk-type"];

  for (const [key, value] of Object.entries(data)) {
    if (key === "name" || key === "description" || key === "grk-type") continue;
    if (key === "grk-name" || key === "grk-description") continue;
    if (CLAUDE_SPECIFIC_FIELDS.includes(key)) continue;
    transformed[key] = value;
  }

  return matter.stringify(body, transformed);
}

/**
 * Build the target path for a skill in .kiro/skills/{safe-name}/SKILL.md
 * Kiro expects skills as SKILL.md inside named folders.
 */
function getSkillFolderName(artifactId: string, filePath: string): string {
  const safeName = toSafeName(artifactId);
  const skillName = basename(resolveComponentFilename(filePath), ".md");
  return `${safeName}-${skillName}`;
}

export const kiroPlugin = createFolderPlugin({
  id: "kiro",
  name: "Kiro",
  targetDir: TARGET_DIR,
  entryPoints: ENTRY_POINTS,
  generateRulesContent: generateDefaultBlockContent,
  syncCategories: ["skills"],

  getTargetPath: (artifactId, category, filePath) => {
    if (category === "skills") {
      const folderName = getSkillFolderName(artifactId, filePath);
      return `${folderName}/SKILL.md`;
    }
    return null;
  },

  transformContent: (content: string) => {
    return transformToKiroFormat(content);
  },

  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },

  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default kiroPlugin;

// MCP distribution config for Kiro (.kiro/settings/mcp.json)
export { kiroMcpConfig } from "./kiro.mcp";
