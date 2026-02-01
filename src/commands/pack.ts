import { Command } from "commander";
import { createTarball } from "#/artifact/tarball/tarball";
import { validateArtifact } from "#/artifact/validation/validation";
import { generateComponents } from "@grekt-labs/cli-engine";
import { success, error, info, log, colors } from "#/shared/ui/ui";

function logComponentSummary(
  artifactId: string,
  version: string,
  scanned: { agent?: unknown; skills: unknown[]; commands: unknown[]; mcps: unknown[]; rules: unknown[] },
  componentCount: number
): void {
  log(colors.bold(`\nPacking ${artifactId}@${version}...`));
  log(colors.dim(`  Components: ${componentCount}`));
  if (scanned.agent) log(colors.dim(`    - 1 agent`));
  if (scanned.skills.length > 0) log(colors.dim(`    - ${scanned.skills.length} skill(s)`));
  if (scanned.commands.length > 0) log(colors.dim(`    - ${scanned.commands.length} command(s)`));
  if (scanned.mcps.length > 0) log(colors.dim(`    - ${scanned.mcps.length} mcp(s)`));
  if (scanned.rules.length > 0) log(colors.dim(`    - ${scanned.rules.length} rule(s)`));
  log("");
}

export const packCommand = new Command("pack")
  .description("Create a tarball from an artifact")
  .argument("[path]", "Path to artifact directory (default: current directory)", ".")
  .action(async (artifactPath: string) => {
    const projectRoot = process.cwd();

    const result = validateArtifact(artifactPath, projectRoot);

    if (!result.success) {
      error(result.error.message);
      if (result.error.details) {
        for (const detail of result.error.details) {
          info(detail);
        }
      }
      process.exit(1);
    }

    const { artifact } = result;

    logComponentSummary(
      artifact.artifactId,
      artifact.manifest.version,
      artifact.scanned,
      artifact.componentCount
    );

    const components = generateComponents(artifact.scanned);

    const tarballResult = createTarball({
      artifactPath: artifact.fullPath,
      artifactId: artifact.artifactId,
      projectRoot,
      components,
    });

    if (!tarballResult.success) {
      error(`Failed to create tarball: ${tarballResult.error}`);
      process.exit(1);
    }

    success(`Created ${tarballResult.filename}`);
    log(`  Path: ${tarballResult.path}`);
    log("");
  });
