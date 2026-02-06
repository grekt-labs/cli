import { checkbox } from "@inquirer/prompts";
import { Separator } from "@inquirer/checkbox";
import { withPromptHandler } from "#/shared/prompts/prompts";
import type { ArtifactInfo } from "#/context";
import {
  CATEGORIES,
  CATEGORY_CONFIG,
  createCategoryRecord,
  type Category,
  type ScannedFile,
} from "@grekt-labs/cli-engine";

/**
 * Represents the user's selection of artifact components.
 * Each category maps to an array of selected file paths.
 */
export type ComponentSelection = Record<Category, string[]>;

type SelectableChoice = {
  name: string;
  value: { category: Category; path: string };
  checked: boolean;
};

type ChoiceItem = SelectableChoice | Separator;

const ROOT_GROUP = "(root)";
const DESCRIPTION_MAX_LENGTH = 40;

/**
 * Create an empty component selection.
 */
export function createEmptySelection(): ComponentSelection {
  return createCategoryRecord<string[]>(() => []);
}

/**
 * Extract the first directory segment from a path.
 * Returns ROOT_GROUP if the file is at the root level.
 */
function getGroupFromPath(filePath: string): string {
  const segments = filePath.split("/");
  if (segments.length === 1) {
    return ROOT_GROUP;
  }
  return segments[0] ?? ROOT_GROUP;
}

/**
 * Get the directory path without the filename.
 * Returns empty string if file is at root.
 */
function getDirectoryPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return "";
  }
  return filePath.substring(0, lastSlash);
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Build the display name for a component choice.
 */
function buildChoiceName(file: ScannedFile, singular: string): string {
  const name = file.parsed.frontmatter["grk-name"];
  const description = file.parsed.frontmatter["grk-description"];
  const directory = getDirectoryPath(file.path);

  let displayName = `${singular}: ${name}`;

  if (directory) {
    displayName += ` (${directory})`;
  }

  if (description) {
    const truncatedDesc = truncate(description, DESCRIPTION_MAX_LENGTH);
    displayName += `  ${truncatedDesc}`;
  }

  return displayName;
}

/**
 * Collect all components from artifact info into a flat array with group info.
 */
function collectComponents(artifactInfo: ArtifactInfo): Array<{
  file: ScannedFile;
  category: Category;
  group: string;
  singular: string;
}> {
  const components: Array<{
    file: ScannedFile;
    category: Category;
    group: string;
    singular: string;
  }> = [];

  for (const category of CATEGORIES) {
    const files = artifactInfo[category];
    const singular = CATEGORY_CONFIG[category].singular;

    for (const file of files) {
      components.push({
        file,
        category,
        group: getGroupFromPath(file.path),
        singular,
      });
    }
  }

  return components;
}

/**
 * Group components by their first directory segment.
 */
function groupComponents(
  components: Array<{ file: ScannedFile; category: Category; group: string; singular: string }>
): Map<string, Array<{ file: ScannedFile; category: Category; singular: string }>> {
  const groups = new Map<string, Array<{ file: ScannedFile; category: Category; singular: string }>>();

  for (const component of components) {
    const existing = groups.get(component.group) ?? [];
    existing.push({
      file: component.file,
      category: component.category,
      singular: component.singular,
    });
    groups.set(component.group, existing);
  }

  return groups;
}

/**
 * Build choices array with separators for each group.
 */
function buildGroupedChoices(
  groups: Map<string, Array<{ file: ScannedFile; category: Category; singular: string }>>
): ChoiceItem[] {
  const choices: ChoiceItem[] = [];

  // Sort groups alphabetically, but put root at the end
  const sortedGroups = Array.from(groups.keys()).sort((a, b) => {
    if (a === ROOT_GROUP) return 1;
    if (b === ROOT_GROUP) return -1;
    return a.localeCompare(b);
  });

  for (const groupName of sortedGroups) {
    const groupComponents = groups.get(groupName)!;

    // Only add separator if there are multiple groups
    if (groups.size > 1) {
      choices.push(new Separator(`── ${groupName} ──`));
    }

    for (const { file, category, singular } of groupComponents) {
      choices.push({
        name: buildChoiceName(file, singular),
        value: { category, path: file.path },
        checked: true,
      });
    }
  }

  return choices;
}

/**
 * Prompt user to select which components to install from an artifact.
 * Returns the paths of selected components.
 */
export async function selectComponents(artifactInfo: ArtifactInfo): Promise<ComponentSelection> {
  return withPromptHandler(async () => {
    const components = collectComponents(artifactInfo);
    const groups = groupComponents(components);
    const choices = buildGroupedChoices(groups);

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
 * Build choices array with separators, using a previous selection
 * to determine the checked state of each item.
 * Items in previousSelection get checked: true, others get checked: false.
 */
function buildGroupedChoicesWithPrecheck(
  groups: Map<string, Array<{ file: ScannedFile; category: Category; singular: string }>>,
  previousSelection: ComponentSelection
): ChoiceItem[] {
  const choices: ChoiceItem[] = [];

  const sortedGroups = Array.from(groups.keys()).sort((a, b) => {
    if (a === ROOT_GROUP) return 1;
    if (b === ROOT_GROUP) return -1;
    return a.localeCompare(b);
  });

  for (const groupName of sortedGroups) {
    const groupComponents = groups.get(groupName)!;

    if (groups.size > 1) {
      choices.push(new Separator(`── ${groupName} ──`));
    }

    for (const { file, category, singular } of groupComponents) {
      choices.push({
        name: buildChoiceName(file, singular),
        value: { category, path: file.path },
        checked: previousSelection[category].includes(file.path),
      });
    }
  }

  return choices;
}

/**
 * Prompt user to select components, pre-checking items from a previous selection.
 * Previously selected components that still exist are checked.
 * New components default to unchecked.
 */
export async function selectComponentsWithPrecheck(
  artifactInfo: ArtifactInfo,
  previousSelection: ComponentSelection
): Promise<ComponentSelection> {
  return withPromptHandler(async () => {
    const components = collectComponents(artifactInfo);
    const groups = groupComponents(components);
    const choices = buildGroupedChoicesWithPrecheck(groups, previousSelection);

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
