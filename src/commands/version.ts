import { Command } from "commander";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import {
  ArtifactManifestSchema,
  updateManifestVersion,
  formatVersionResults,
  getArtifactIdFromManifest,
} from "@grekt-labs/cli-engine";
import { createVersionCalculator } from "#/versioning";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";

const MANIFEST_FILE = "grekt.yaml";

interface VersionCommandOptions {
  dryRun?: boolean;
}

export const versionCommand = new Command("version")
  .description("Calculate and apply semantic versions to artifacts based on conventional commits")
  .argument("[path]", "Path to artifact or directory containing artifacts", ".")
  .option("--dry-run", "Show what versions would be generated without applying")
  .action(async (targetPath: string, options: VersionCommandOptions) => {
    const absolutePath = resolve(targetPath);

    if (!existsSync(absolutePath)) {
      error(`Path not found: ${absolutePath}`);
      process.exit(1);
    }

    // Find all artifacts (directories with grekt.yaml)
    const artifactPaths = findArtifacts(absolutePath);

    if (artifactPaths.length === 0) {
      error("No artifacts found (directories with grekt.yaml)");
      process.exit(1);
    }

    log("");
    info(`Found ${artifactPaths.length} artifact(s)`);

    if (options.dryRun) {
      log(colors.dim("  (dry-run mode)"));
    }
    log("");

    const spin = spinner("Analyzing commits...");
    spin.start();

    try {
      // Load manifests
      const manifests = new Map<string, { name: string; version: string; raw: string }>();

      for (const artifactPath of artifactPaths) {
        const manifestPath = join(artifactPath, MANIFEST_FILE);
        const manifestContent = readFileSync(manifestPath, "utf-8");
        const parsed = parseYaml(manifestContent);
        const manifest = ArtifactManifestSchema.parse(parsed);
        const artifactId = getArtifactIdFromManifest(manifest);

        manifests.set(artifactPath, {
          name: artifactId,
          version: manifest.version,
          raw: manifestContent,
        });
      }

      // Calculate versions using the abstracted calculator
      const calculator = createVersionCalculator();
      const versionResults = await calculator.calculate(
        artifactPaths,
        manifests,
        { dryRun: options.dryRun }
      );

      spin.stop();

      // Display results
      const lines = formatVersionResults(versionResults);
      for (const line of lines) {
        log(`  ${line}`);
      }
      log("");

      // Apply changes (if not dry-run)
      if (!options.dryRun) {
        let updated = 0;
        for (const result of versionResults) {
          if (result.newVersion) {
            const cached = manifests.get(result.artifactPath);
            if (cached) {
              const manifestPath = join(result.artifactPath, MANIFEST_FILE);

              // Update version in the raw YAML to preserve formatting
              const updatedContent = cached.raw.replace(
                /^version:\s*["']?[\d.]+[-\w.]*["']?/m,
                `version: "${result.newVersion}"`
              );
              writeFileSync(manifestPath, updatedContent);
              updated++;
            }
          }
        }

        if (updated > 0) {
          success(`Updated ${updated} artifact(s)`);
        } else {
          info("No artifacts needed updates");
        }
      }

    } catch (err) {
      spin.stop();
      error(err instanceof Error ? err.message : "Version calculation failed");
      process.exit(1);
    }
  });

/**
 * Find all directories containing grekt.yaml
 */
function findArtifacts(basePath: string): string[] {
  const artifacts: string[] = [];

  // Check if basePath itself is an artifact
  if (existsSync(join(basePath, MANIFEST_FILE))) {
    artifacts.push(basePath);
    return artifacts;
  }

  // Scan subdirectories
  try {
    const entries = readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subPath = join(basePath, entry.name);
        if (existsSync(join(subPath, MANIFEST_FILE))) {
          artifacts.push(subPath);
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return artifacts;
}
