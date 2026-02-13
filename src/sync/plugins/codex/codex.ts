import { basename, join } from "path";
import matter from "gray-matter";
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { toSafeName } from "@grekt-labs/cli-engine";
import { fs } from "#/context";

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

/**
 * Copy sibling files and directories next to a synced SKILL.md.
 * Only applies when the skill source is a directory (e.g., skills/create-module/SKILL.md).
 * For flat skill files (e.g., skills/create-module.md), sourceDir is the parent category
 * directory shared by all skills, so copying siblings would be incorrect.
 */
function copySiblingFiles(sourceDir: string, targetDir: string, sourceFilePath: string): void {
  if (!fs.exists(sourceDir)) return;

  // Only copy siblings if the source is a SKILL.md inside a dedicated directory.
  // For flat .md files, sourceDir is the shared category directory — skip.
  const sourceFileName = basename(sourceFilePath);
  if (sourceFileName !== "SKILL.md") return;

  const entries = fs.readdir(sourceDir);

  for (const entry of entries) {
    // Skip the SKILL.md itself
    if (entry === "SKILL.md") continue;
    // Skip grekt metadata
    if (entry === "grekt.yaml" || entry === ".grekt") continue;

    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stat = fs.stat(sourcePath);

    if (stat.isDirectory) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (stat.isFile) {
      ensureDir(targetPath);
      fs.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Recursively copy a directory and all its contents.
 */
function copyDirectoryRecursive(source: string, target: string): void {
  fs.mkdir(target, { recursive: true });

  const entries = fs.readdir(source);
  for (const entry of entries) {
    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);
    const stat = fs.stat(sourcePath);

    if (stat.isDirectory) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (stat.isFile) {
      fs.copyFile(sourcePath, targetPath);
    }
  }
}

export const codexPlugin = createFolderPlugin({
  id: "codex",
  name: "Codex",
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
});

export default codexPlugin;
