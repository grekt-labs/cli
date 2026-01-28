import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { parse } from "yaml";
import { isInitialized } from "#/config/project/project";
import { fs as cliFs } from "#/context";
import { createTarball } from "#/artifact/tarball/tarball";
import { success, error, info, log, colors } from "#/shared/ui/ui";
import { scanArtifact, ArtifactManifestSchema, isValidSemver } from "@grekt-labs/cli-engine";

export const packCommand = new Command("pack")
  .description("Create a tarball from an artifact")
  .argument("<path>", "Path to artifact directory")
  .action(async (artifactPath: string) => {
    const fullPath = resolve(artifactPath);
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("Not in a grekt project. Run 'grekt init' first.");
      process.exit(1);
    }

    if (!existsSync(fullPath)) {
      error(`Artifact not found: ${fullPath}`);
      process.exit(1);
    }

    const manifestPath = join(fullPath, "grekt.yaml");
    if (!existsSync(manifestPath)) {
      error(`Missing grekt.yaml in ${fullPath}`);
      process.exit(1);
    }

    const rawManifest = parse(readFileSync(manifestPath, "utf-8"));

    const manifestResult = ArtifactManifestSchema.safeParse(rawManifest);
    if (!manifestResult.success) {
      error("Invalid grekt.yaml manifest");
      for (const issue of manifestResult.error.issues) {
        log(`  ${colors.dim(issue.path.join("."))} ${issue.message}`);
      }
      process.exit(1);
    }

    const manifest = manifestResult.data;
    const artifactId = `@${manifest.author}/${manifest.name}`;

    if (!isValidSemver(manifest.version)) {
      error(`Invalid version: ${manifest.version}`);
      info("Version must be valid semver (e.g., 1.0.0, 2.1.0-beta.1)");
      process.exit(1);
    }

    const scanned = scanArtifact(cliFs, fullPath);
    if (!scanned) {
      error("Failed to scan artifact");
      process.exit(1);
    }

    const componentCount =
      (scanned.agent ? 1 : 0) +
      scanned.skills.length +
      scanned.commands.length +
      scanned.mcps.length +
      scanned.rules.length;

    if (componentCount === 0) {
      error("Artifact has no valid components");
      info("Add at least one agent, skill, command, mcp, or rule file");
      info("Files must have valid frontmatter (type, name, description)");
      process.exit(1);
    }

    log(colors.bold(`\nPacking ${artifactId}@${manifest.version}...`));
    log(colors.dim(`  Components: ${componentCount}`));
    if (scanned.agent) log(colors.dim(`    - 1 agent`));
    if (scanned.skills.length > 0) log(colors.dim(`    - ${scanned.skills.length} skill(s)`));
    if (scanned.commands.length > 0) log(colors.dim(`    - ${scanned.commands.length} command(s)`));
    if (scanned.mcps.length > 0) log(colors.dim(`    - ${scanned.mcps.length} mcp(s)`));
    if (scanned.rules.length > 0) log(colors.dim(`    - ${scanned.rules.length} rule(s)`));
    log("");

    const result = createTarball({
      artifactPath: fullPath,
      artifactId,
      projectRoot,
    });

    if (!result.success) {
      error(`Failed to create tarball: ${result.error}`);
      process.exit(1);
    }

    success(`Created ${result.filename}`);
    log(`  Path: ${result.path}`);
    log("");
  });
