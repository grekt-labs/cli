import { checkbox } from "@inquirer/prompts";
import { withPromptHandler } from "#/shared/prompts/prompts";
import type { ArtifactInfo } from "#/context";
import { CATEGORIES, CATEGORY_CONFIG, createCategoryRecord, type Category } from "@grekt-labs/cli-engine";

/**
 * Represents the user's selection of artifact components.
 * Each category maps to an array of selected file paths.
 */
export type ComponentSelection = Record<Category, string[]>;

/**
 * Create an empty component selection.
 */
export function createEmptySelection(): ComponentSelection {
  return createCategoryRecord<string[]>(() => []);
}

/**
 * Prompt user to select which components to install from an artifact.
 * Returns the paths of selected components.
 */
export async function selectComponents(artifactInfo: ArtifactInfo): Promise<ComponentSelection> {
  return withPromptHandler(async () => {
    const choices: Array<{ name: string; value: { category: Category; path: string }; checked: boolean }> = [];

    for (const category of CATEGORIES) {
      const files = artifactInfo[category];
      const singular = CATEGORY_CONFIG[category].singular;

      for (const file of files) {
        choices.push({
          name: `${singular}: ${file.parsed.frontmatter["grk-name"]}`,
          value: { category, path: file.path },
          checked: true,
        });
      }
    }

    const selected = await checkbox({
      message: "Select components to install:",
      choices,
    });

    const result = createEmptySelection();

    for (const item of selected) {
      result[item.category].push(item.path);
    }

    return result;
  });
}

/**
 * Check if all components in the artifact were selected.
 */
export function isFullSelection(artifactInfo: ArtifactInfo, selection: ComponentSelection): boolean {
  return CATEGORIES.every(
    (category) => selection[category].length === artifactInfo[category].length
  );
}

/**
 * Check if no components were selected.
 */
export function isEmptySelection(selection: ComponentSelection): boolean {
  return CATEGORIES.every((category) => selection[category].length === 0);
}
