import { ExitPromptError } from "@inquirer/core";
import { input, confirm } from "@inquirer/prompts";
import { newline, info, log, colors } from "#/shared/ui/ui";
import { CATEGORIES, type CustomTarget, type ComponentPaths, type Category } from "@grekt-labs/cli-engine";

export interface PromptCustomTargetResult {
  id: string;
  config: CustomTarget;
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
    message: "Target ID (e.g., my-ai):",
    validate: (value) => {
      if (!value.trim()) return "ID is required";
      if (!/^[a-z0-9-]+$/.test(value)) return "ID must be lowercase alphanumeric with dashes";
      if (builtInIds.includes(value)) return "ID conflicts with built-in target";
      return true;
    },
  });

  const name = await input({
    message: "Display name (e.g., My AI Tool):",
    validate: (value) => (value.trim() ? true : "Name is required"),
  });

  const contextEntryPoint = await input({
    message: "Context entry point (e.g., .my-ai/instructions.md):",
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
