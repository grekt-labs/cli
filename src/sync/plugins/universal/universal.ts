import { basename } from "path";
import matter from "gray-matter";
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { toSafeName } from "@grekt/engine";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".agents";
const ENTRY_POINTS = ["AGENTS.md"];

/** Claude-specific frontmatter fields that have no meaning outside Claude Code */
const CLAUDE_SPECIFIC_FIELDS = [
  "argument-hint",
  "disable-model-invocation",
  "user-invocable",
  "model",
  "context",
  "agent",
  "hooks",
];

/**
 * Transform grekt frontmatter to agentskills.io standard format.
 *
 * - grk-name / grk-description → name / description (if not already present)
 * - grk-type is preserved (grekt needs it)
 * - Claude-specific fields are stripped (no meaning outside Claude)
 * - allowed-tools is kept (part of agentskills.io spec)
 */
function transformToAgentSkills(content: string): string {
  const { data, content: body } = matter(content);

  const transformed: Record<string, unknown> = {};

  // Standard agentskills.io fields from grk-* equivalents
  transformed["name"] = data["name"] ?? data["grk-name"];
  transformed["description"] = data["description"] ?? data["grk-description"];

  // grk-type always stays
  transformed["grk-type"] = data["grk-type"];

  // Copy remaining fields, skipping grk-name/grk-description (already mapped)
  // and Claude-specific fields
  for (const [key, value] of Object.entries(data)) {
    if (key === "name" || key === "description" || key === "grk-type") continue;
    if (key === "grk-name" || key === "grk-description") continue;
    if (CLAUDE_SPECIFIC_FIELDS.includes(key)) continue;
    transformed[key] = value;
  }

  return matter.stringify(body, transformed);
}

/**
 * Build the target path for a skill in .agents/skills/{safe-name}/SKILL.md
 * Uses the same safe naming as Claude plugin to avoid collisions between artifacts.
 */
function getSkillTargetPath(artifactId: string, filePath: string): string {
  const safeName = toSafeName(artifactId);
  const skillName = basename(filePath, ".md");
  return `${safeName}-${skillName}/SKILL.md`;
}

export const globalPlugin = createFolderPlugin({
  id: "global",
  name: "Global (.agents/)",
  targetDir: TARGET_DIR,
  entryPoints: ENTRY_POINTS,
  generateRulesContent: generateDefaultBlockContent,
  syncCategories: ["skills"],

  getTargetPath: (artifactId: string, _category: string, filePath: string) => {
    return getSkillTargetPath(artifactId, filePath);
  },

  transformContent: (content: string) => {
    return transformToAgentSkills(content);
  },

  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default globalPlugin;
