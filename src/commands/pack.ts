import { Command } from "commander";
import { createTarball } from "#/artifact/tarball/tarball";
import { validateArtifact } from "#/artifact/validation/validation";
import { generateComponents } from "@grekt/engine";
import { success, error, info, log } from "#/shared/ui/ui";
import { logComponentSummary } from "./display";

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

    logComponentSummary({
      artifactId: artifact.artifactId,
      version: artifact.manifest.version,
      action: "Packing",
      scanned: artifact.scanned,
      componentCount: artifact.componentCount,
    });

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
