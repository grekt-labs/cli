import { Command } from "commander";
import { requireInitialized } from "#/shared/guards/guards";
import { getConfig, saveConfig } from "#/config/project/project";
import type { ArtifactEntry } from "@grekt-labs/cli-engine";
import { success, error, info, colors } from "#/shared/ui/ui";

export function ensureLongForm(entry: ArtifactEntry): Exclude<ArtifactEntry, string> {
  if (typeof entry === "string") {
    return { version: entry, mode: "lazy" };
  }
  return entry;
}

export const trustCommand = new Command("trust")
  .description("Mark an artifact as trusted (excluded from --fail-on checks)")
  .argument("<artifact>", "Artifact ID (e.g., @scope/name)")
  .action((artifactId: string) => {
    const projectRoot = process.cwd();
    requireInitialized(projectRoot);

    const config = getConfig(projectRoot);

    if (!config.artifacts[artifactId]) {
      error(`Artifact ${colors.highlight(artifactId)} is not in config`);
      info("Add it first with 'grekt add'");
      process.exit(1);
    }

    const entry = ensureLongForm(config.artifacts[artifactId]);
    entry.trusted = true;
    config.artifacts[artifactId] = entry;
    saveConfig(config, projectRoot);

    success(`Marked ${colors.highlight(artifactId)} as trusted`);
  });

export const untrustCommand = new Command("untrust")
  .description("Remove trusted status from an artifact")
  .argument("<artifact>", "Artifact ID (e.g., @scope/name)")
  .action((artifactId: string) => {
    const projectRoot = process.cwd();
    requireInitialized(projectRoot);

    const config = getConfig(projectRoot);

    if (!config.artifacts[artifactId]) {
      error(`Artifact ${colors.highlight(artifactId)} is not in config`);
      info("Add it first with 'grekt add'");
      process.exit(1);
    }

    const entry = config.artifacts[artifactId];

    if (typeof entry === "string") {
      info(`${colors.highlight(artifactId)} is already not trusted`);
      return;
    }

    delete entry.trusted;
    config.artifacts[artifactId] = entry;
    saveConfig(config, projectRoot);

    success(`Removed trusted status from ${colors.highlight(artifactId)}`);
  });
