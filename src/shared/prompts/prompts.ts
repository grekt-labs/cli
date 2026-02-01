import { ExitPromptError } from "@inquirer/core";
import { input, confirm, checkbox } from "@inquirer/prompts";
import { newline, info, log, colors } from "#/shared/ui/ui";
import { CATEGORIES, type CustomTarget, type ComponentPaths, type Category } from "@grekt-labs/cli-engine";

export interface PromptCustomTargetResult {
  id: string;
  config: CustomTarget;
}

export interface SelectTargetsResult {
  targets: string[];
  customTargets: Record<string, CustomTarget>;
}

export interface SelectTargetsOptions {
  currentTargets?: string[];
  currentCustomTargets?: Record<string, CustomTarget>;
  defaultCheckedIndex?: number;
}

/**
 * Wrap an async function that uses interactive prompts.
 * Handles Ctrl+C gracefully with a friendly exit message.
 */
export async function withPromptHandler<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ExitPromptError) {
      newline();
      info("Happy artifacting!");
      process.exit(0);
      return undefined as T; // Unreachable, but needed for tests where process.exit is mocked
    }
    throw error;
  }
}

/**
 * Prompt user to configure a custom sync target.
 * Returns the target ID and configuration.
 */
export async function promptCustomTarget(
  builtInIds: string[]
): Promise<PromptCustomTargetResult> {
  newline();
  log(colors.bold("Configure custom target:"));
  newline();

  const id = await input({
    message: "Internal ID for grekt config (e.g., codex-gpt, my-custom-ai):",
    validate: (value) => {
      if (!value.trim()) return "ID is required";
      if (!/^[a-z0-9-]+$/.test(value)) return "Use kebab-case: lowercase letters, numbers, and dashes only";
      if (builtInIds.includes(value)) return `"${value}" is a built-in target, choose a different ID`;
      return true;
    },
  });

  const name = await input({
    message: "Display name shown in CLI output (e.g., Codex GPT, My AI Tool):",
    validate: (value) => (value.trim() ? true : "Name is required"),
  });

  const contextEntryPoint = await input({
    message: "Main context file for this AI (e.g., .my-ai/instructions.md):",
    validate: (value) => (value.trim() ? true : "Context entry point is required"),
  });

  const config: CustomTarget = {
    name,
    contextEntryPoint,
  };

  const categoryList = CATEGORIES.join("/");
  const configurePaths = await confirm({
    message: `Configure custom paths for artifacts (${categoryList})?`,
    default: false,
  });

  if (configurePaths) {
    const paths: Partial<ComponentPaths> = {};

    for (const category of CATEGORIES) {
      const categoryPath = await input({
        message: `${category.charAt(0).toUpperCase() + category.slice(1)} path (e.g., .my-ai/${category}):`,
        validate: (value) => (value.trim() ? true : "Path is required"),
      });
      paths[category] = categoryPath;
    }

    config.paths = paths;
  }

  return { id, config };
}

const OTHER_TARGET_VALUE = "__other__";

/**
 * Interactive prompt to select sync targets.
 * Handles built-in plugins and custom target configuration.
 */
export async function selectTargets(
  pluginChoices: Array<{ name: string; value: string }>,
  options: SelectTargetsOptions = {}
): Promise<SelectTargetsResult> {
  const {
    currentTargets = [],
    currentCustomTargets = {},
    defaultCheckedIndex,
  } = options;

  const currentTargetSet = new Set(currentTargets);

  const choices = [
    ...pluginChoices.map((choice, index) => ({
      ...choice,
      checked: currentTargetSet.has(choice.value) ||
        (currentTargetSet.size === 0 && index === defaultCheckedIndex),
    })),
    {
      name: "Other (custom)",
      value: OTHER_TARGET_VALUE,
      checked: false,
    },
  ];

  const selected = await checkbox<string>({
    message: "Select AI tools to sync with:",
    choices,
  });

  const customTargets: Record<string, CustomTarget> = { ...currentCustomTargets };
  let targets: string[];

  if (selected.includes(OTHER_TARGET_VALUE)) {
    const builtInIds = pluginChoices.map((p) => p.value);
    const { id: customId, config: customTarget } = await promptCustomTarget(builtInIds);

    customTargets[customId] = customTarget;

    targets = selected.filter((t) => t !== OTHER_TARGET_VALUE);
    targets.push(customId);
  } else {
    targets = selected;
  }

  return { targets, customTargets };
}
