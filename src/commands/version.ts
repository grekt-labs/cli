import { Command } from "commander";
import { join, resolve } from "path";
import { fs } from "#/context";
import { parse as parseYaml } from "yaml";
import {
  ArtifactManifestSchema,
  parseName,
  bumpVersion,
  type BumpType,
} from "@grekt-labs/cli-engine";
import { success, error, info, log, colors } from "#/shared/ui/ui";

const MANIFEST_FILE = "grekt.yaml";
const BUMP_TYPES = ["patch", "minor", "major"] as const;

interface VersionCommandOptions {
  dryRun?: boolean;
}

function isBumpType(value: string): value is BumpType {
  return BUMP_TYPES.includes(value as BumpType);
}

export const versionCommand = new Command("version")
  .description("Bump artifact versions (patch, minor, major)")
  .argument("[bump]", "Bump type: patch, minor, or major")
  .argument("[path]", "Path to artifact or directory containing artifacts", ".")
  .option("--dry-run", "Show what would happen without applying changes")
  .action(async (bump: string | undefined, targetPath: string, options: VersionCommandOptions) => {
    if (!bump) {
      error("Bump type required. Usage:");
      info("  grekt version patch");
      info("  grekt version minor");
      info("  grekt version major");
      process.exit(1);
    }

    if (!isBumpType(bump)) {
      error(`Invalid bump type: ${bump}`);
      info("Use: patch, minor, or major");
      process.exit(1);
    }

    const absolutePath = resolve(targetPath);

    if (!fs.exists(absolutePath)) {
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

    let updated = 0;

    for (const artifactPath of artifactPaths) {
      const manifestPath = join(artifactPath, MANIFEST_FILE);
      const manifestContent = fs.readFile(manifestPath);
      const parsed = parseYaml(manifestContent);
      const manifest = ArtifactManifestSchema.parse(parsed);
      const { artifactId } = parseName(manifest.name);

      const newVersion = bumpVersion(manifest.version, bump);

      log(`  ${artifactId}: ${manifest.version} → ${newVersion}`);

      if (!options.dryRun) {
        const updatedContent = manifestContent.replace(
          /^version:\s*["']?[\d.]+[-\w.]*["']?/m,
          `version: "${newVersion}"`
        );
        fs.writeFile(manifestPath, updatedContent);
        updated++;
      }
    }

    log("");

    if (options.dryRun) {
      info("Dry run complete");
    } else if (updated > 0) {
      success(`Updated ${updated} artifact(s)`);
    }
  });

/**
 * Find all directories containing grekt.yaml
 */
function findArtifacts(basePath: string): string[] {
  const artifacts: string[] = [];

  // Check if basePath itself is an artifact
  if (fs.exists(join(basePath, MANIFEST_FILE))) {
    artifacts.push(basePath);
    return artifacts;
  }

  // Scan subdirectories
  try {
    const entries = fs.readdir(basePath);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const subPath = join(basePath, entry);
      const stat = fs.stat(subPath);
      if (stat.isDirectory && fs.exists(join(subPath, MANIFEST_FILE))) {
        artifacts.push(subPath);
      }
    }
  } catch {
    // Ignore read errors
  }

  return artifacts;
}
