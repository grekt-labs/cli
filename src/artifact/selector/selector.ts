import { checkbox } from "@inquirer/prompts";
import { withPromptHandler } from "#/shared/prompts/prompts";
import type { ArtifactInfo } from "#/context";

/**
 * Represents the user's selection of artifact components.
 */
export interface ComponentSelection {
  agent: string | undefined;
  skills: string[];
  commands: string[];
}

/**
 * Prompt user to select which components to install from an artifact.
 * Returns the paths of selected components.
 */
export async function selectComponents(artifactInfo: ArtifactInfo): Promise<ComponentSelection> {
  return withPromptHandler(async () => {
    const choices: Array<{ name: string; value: { type: string; path: string }; checked: boolean }> = [];

    if (artifactInfo.agent) {
      choices.push({
        name: `agent: ${artifactInfo.agent.parsed.frontmatter["grk-name"]}`,
        value: { type: "agent", path: artifactInfo.agent.path },
        checked: true,
      });
    }

    for (const skill of artifactInfo.skills) {
      choices.push({
        name: `skill: ${skill.parsed.frontmatter["grk-name"]}`,
        value: { type: "skill", path: skill.path },
        checked: true,
      });
    }

    for (const cmd of artifactInfo.commands) {
      choices.push({
        name: `command: ${cmd.parsed.frontmatter["grk-name"]}`,
        value: { type: "command", path: cmd.path },
        checked: true,
      });
    }

    const selected = await checkbox({
      message: "Select components to install:",
      choices,
    });

    const result: ComponentSelection = {
      agent: undefined,
      skills: [],
      commands: [],
    };

    for (const item of selected) {
      if (item.type === "agent") {
        result.agent = item.path;
      } else if (item.type === "skill") {
        result.skills.push(item.path);
      } else if (item.type === "command") {
        result.commands.push(item.path);
      }
    }

    return result;
  });
}

/**
 * Check if all components in the artifact were selected.
 */
export function isFullSelection(artifactInfo: ArtifactInfo, selection: ComponentSelection): boolean {
  const allAgent = artifactInfo.agent ? selection.agent === artifactInfo.agent.path : true;
  const allSkills = selection.skills.length === artifactInfo.skills.length;
  const allCommands = selection.commands.length === artifactInfo.commands.length;
  return allAgent && allSkills && allCommands;
}

/**
 * Check if no components were selected.
 */
export function isEmptySelection(selection: ComponentSelection): boolean {
  return !selection.agent && selection.skills.length === 0 && selection.commands.length === 0;
}
