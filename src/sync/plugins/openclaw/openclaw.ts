import { basename } from "path";
import { createFolderPlugin } from "#/sync/base/base";
import { toSafeName, scanArtifact, GREKT_SECTION_HEADER, type Lockfile, type Category } from "@grekt-labs/cli-engine";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { fs } from "#/context";
import matter from "gray-matter";

const TARGET_DIR = "skills";
const ENTRY_POINTS = ["AGENTS.md"];
const AGENT_PREFIX = "agent-";

const SYNCABLE_CATEGORIES: Category[] = ["skills", "agents", "commands"];

/**
 * Build folder name for a skill in OpenClaw's skills/ directory.
 * Agents get an "agent-" prefix per OpenClaw convention.
 */
function getSkillFolderName(artifactId: string, category: string, filePath: string): string {
  const safeName = toSafeName(artifactId);
  const skillName = basename(filePath, ".md");

  // If the file is already SKILL.md inside a directory, use artifact name only
  const base = skillName === "SKILL" ? safeName : `${safeName}-${skillName}`;
  return category === "agents" ? `${AGENT_PREFIX}${base}` : base;
}

/**
 * Transform grekt frontmatter to OpenClaw frontmatter.
 * Only affects the output file — source artifacts in .grekt/artifacts/ stay untouched.
 */
function transformToOpenClaw(content: string, category: Category): string {
  const { data, content: body } = matter(content);

  const openclawFrontmatter: Record<string, unknown> = {
    name: data["grk-name"] || data["name"] || "",
    description: data["grk-description"] || data["description"] || "",
    "user-invocable": category !== "agents",
  };

  // Pass through non-grk fields that OpenClaw understands
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("grk-")) continue;
    if (["name", "description", "type"].includes(key)) continue;

    // OpenClaw requires metadata as single-line JSON
    if (key === "metadata" && typeof value === "object" && value !== null) {
      openclawFrontmatter[key] = JSON.stringify(value);
      continue;
    }

    openclawFrontmatter[key] = value;
  }

  return matter.stringify(body, openclawFrontmatter);
}

/**
 * Generate AGENTS.md managed block content from synced artifacts.
 * Lists all skills with routing hints for OpenClaw's skill dispatcher.
 *
 * NOTE: Uses process.cwd() because FolderPluginConfig.generateRulesContent
 * only receives a Lockfile — no projectRoot parameter. This works because
 * the CLI always runs from project root (enforced by requireInitialized).
 * If the signature ever changes to include projectRoot, replace process.cwd().
 */
function generateOpenClawBlockContent(lockfile: Lockfile): string {
  const skills: Array<{ name: string; description: string; isAgent: boolean }> = [];

  const projectRoot = process.cwd();

  for (const artifactId of Object.keys(lockfile.artifacts)) {
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
    const artifactInfo = scanArtifact(fs, artifactDir);
    if (!artifactInfo) continue;

    for (const category of SYNCABLE_CATEGORIES) {
      const files = artifactInfo[category];
      if (!files || files.length === 0) continue;

      for (const scannedFile of files) {
        const frontmatter = scannedFile.parsed.frontmatter;
        skills.push({
          name: frontmatter["grk-name"],
          description: frontmatter["grk-description"],
          isAgent: category === "agents",
        });
      }
    }
  }

  const lines: string[] = [
    GREKT_SECTION_HEADER,
    "",
    "## Skill Routing",
    "",
    "Routing priorities (strict order):",
    "1. Explicit user skill mention",
    "2. Multi-step requests → orchestrator (if present)",
    "3. Intent matching from descriptions below",
    "4. Generic fallback",
    "",
    "## Available Skills (managed by grekt)",
    "",
  ];

  if (skills.length === 0) {
    lines.push("No skills synced yet. Run `grekt add` and `grekt sync` to populate.");
  } else {
    for (const skill of skills) {
      const suffix = skill.isAgent ? " (specialist, auto-routed)" : "";
      lines.push(`- **${skill.name}** — ${skill.description}${suffix}`);
    }
  }

  return lines.join("\n");
}

export const openclawPlugin = createFolderPlugin({
  id: "openclaw",
  name: "OpenClaw",
  targetDir: TARGET_DIR,
  entryPoints: ENTRY_POINTS,
  syncCategories: SYNCABLE_CATEGORIES,
  generateRulesContent: generateOpenClawBlockContent,
  getTargetPath: (artifactId, category, filePath) => {
    return `${getSkillFolderName(artifactId, category, filePath)}/SKILL.md`;
  },
  transformContent: (content, category) => {
    return transformToOpenClaw(content, category);
  },
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
});

export default openclawPlugin;
