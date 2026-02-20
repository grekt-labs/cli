import { getSkillRouterTemplate } from "@grekt-labs/cli-engine";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { fs } from "#/context";

const SKILL_ROUTER_FILENAME = "skills/grekt/SKILL.md";

const STANDARD_FRONTMATTER = `---
name: grekt
description: Search and load grekt artifact skills by name or intent
---`;

/**
 * Build the skill-router content with standard agentskills.io frontmatter.
 * Claude plugin overrides this with its own frontmatter (argument-hint, allowed-tools).
 */
function buildStandardSkillRouterContent(): string {
  return `${STANDARD_FRONTMATTER}\n\n${getSkillRouterTemplate()}`;
}

/**
 * Write the skill-router SKILL.md to a target directory.
 * Called on every sync to keep it up to date with the CLI version.
 */
export function writeSkillRouter(projectRoot: string, targetDir: string): void {
  const skillRouterFile = `${projectRoot}/${targetDir}/${SKILL_ROUTER_FILENAME}`;

  ensureDir(skillRouterFile);
  fs.writeFile(skillRouterFile, buildStandardSkillRouterContent());
}
