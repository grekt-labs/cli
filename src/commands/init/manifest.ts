import { basename } from "path";
import { input } from "@inquirer/prompts";
import { log, newline, colors } from "#/shared/ui/ui";
import type { ProjectConfig } from "@grekt/engine";

/**
 * Prompt for artifact manifest fields (--artifact mode).
 * Returns partial config with name, author, version, description, keywords.
 */
export async function promptManifestFields(projectRoot: string): Promise<Partial<ProjectConfig>> {
  log(colors.bold("Artifact manifest:"));
  newline();

  const defaultName = basename(projectRoot);

  const name = await input({
    message: "Artifact name:",
    default: defaultName,
    validate: (value) => {
      if (!value.trim()) return "Name is required";
      if (!/^[a-z0-9-]+$/.test(value)) return "Name must be lowercase alphanumeric with dashes";
      return true;
    },
  });

  const authorInput = await input({
    message: "Author (e.g., grekt):",
    validate: (value) => (value.trim() ? true : "Author is required"),
  });
  const author = authorInput.startsWith("@") ? authorInput.slice(1) : authorInput;

  const version = await input({
    message: "Version:",
    default: "1.0.0",
    validate: (value) => {
      if (!value.trim()) return "Version is required";
      if (!/^\d+\.\d+\.\d+/.test(value)) return "Version must be semver (e.g., 1.0.0)";
      return true;
    },
  });

  const description = await input({
    message: "Description:",
    validate: (value) => (value.trim() ? true : "Description is required"),
  });

  const keywordsStr = await input({
    message: "Keywords (comma-separated, 3-5 recommended):",
    validate: (value) => {
      const keywords = value.split(",").map((k) => k.trim()).filter(Boolean);
      if (keywords.length === 0) return "At least one keyword is required";
      return true;
    },
  });

  const keywords = keywordsStr.split(",").map((k) => k.trim()).filter(Boolean);

  newline();
  return { name, author, version, description, keywords };
}
