import { Command } from "commander";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import {
  ArtifactManifestSchema,
  formatVersionResults,
  getArtifactIdFromManifest,
  bumpVersion,
  type BumpType,
  type VersionResult,
} from "@grekt-labs/cli-engine";
import { createVersionCalculator } from "#/versioning";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";

const MANIFEST_FILE = "grekt.yaml";
const BUMP_TYPES = ["patch", "minor", "major"] as const;

interface VersionCommandOptions {
  dryRun?: boolean;
}

function isBumpType(value: string): value is BumpType {
  return BUMP_TYPES.includes(value as BumpType);
}

export const versionCommand = new Command("version")
  .description("Bump artifact versions manually or automatically via conventional commits")
  .argument("[bump]", "Bump type (patch, minor, major) or path to artifact")
  .argument("[path]", "Path to artifact (if first arg is bump type)")
  .option("--dry-run", "Show what would happen without applying changes")
  .action(async (firstArg: string | undefined, secondArg: string | undefined, options: VersionCommandOptions) => {
    // Parse arguments: could be (bumpType, path), (path), or ()
    let bumpType: BumpType | undefined;
    let targetPath: string;

    if (firstArg && isBumpType(firstArg)) {
      bumpType = firstArg;
      targetPath = secondArg ?? ".";
    } else {
      targetPath = firstArg ?? ".";
    }

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

    let versionResults: VersionResult[];

    if (bumpType) {
      // Manual bump
      versionResults = manualBump(artifactPaths, manifests, bumpType);
    } else {
      // Auto from conventional commits
      const spin = spinner("Analyzing commits...");
      spin.start();

      try {
        const calculator = createVersionCalculator();
        versionResults = await calculator.calculate(
          artifactPaths,
          manifests,
          { dryRun: options.dryRun }
        );
        spin.stop();
      } catch (err) {
        spin.stop();
        error(err instanceof Error ? err.message : "Version calculation failed");
        log("");
        info("Tip: Use 'grekt version patch|minor|major' for manual bumps");
        process.exit(1);
      }

      // Check if no versions were calculated
      const hasChanges = versionResults.some(r => r.newVersion);
      if (!hasChanges) {
        info("No version changes detected from commits");
        log("");
        info("Tip: Use 'grekt version patch|minor|major' for manual bumps");
        process.exit(0);
      }
    }

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
  });

/**
 * Manual version bump for all artifacts
 */
function manualBump(
  artifactPaths: string[],
  manifests: Map<string, { name: string; version: string }>,
  bumpType: BumpType
): VersionResult[] {
  const results: VersionResult[] = [];

  for (const artifactPath of artifactPaths) {
    const cached = manifests.get(artifactPath);
    if (!cached) continue;

    const newVersion = bumpVersion(cached.version, bumpType);

    results.push({
      artifactPath,
      artifactId: cached.name,
      previousVersion: cached.version,
      newVersion,
      releaseType: bumpType,
      commits: 0,
    });
  }

  return results;
}

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
