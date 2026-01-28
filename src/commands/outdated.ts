import { Command } from "commander";
import { isInitialized } from "#/config/project/project";
import { getLockfile } from "#/context";
import { createRegistryClient } from "#/registry/api-client/api-client";
import { compareSemver } from "@grekt-labs/cli-engine";
import { error, info, log, colors, spinner } from "#/shared/ui/ui";

interface OutdatedEntry {
  artifactId: string;
  current: string;
  latest: string;
  isOutdated: boolean;
}

export const outdatedCommand = new Command("outdated")
  .description("Check for outdated artifacts (public registry only)")
  .action(async () => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const lockfile = getLockfile(projectRoot);
    const artifacts = Object.entries(lockfile.artifacts);

    if (artifacts.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    // Filter to only registry artifacts (skip github:, gitlab: sources)
    const registryArtifacts = artifacts.filter(([_, entry]) => {
      const source = entry.source || "";
      return !source.startsWith("github:") && !source.startsWith("gitlab:");
    });

    if (registryArtifacts.length === 0) {
      info("No registry artifacts to check (all artifacts are from git sources)");
      process.exit(0);
    }

    const spin = spinner("Checking for updates...");
    spin.start();

    const client = createRegistryClient();
    const results: OutdatedEntry[] = [];

    for (const [artifactId, entry] of registryArtifacts) {
      try {
        const metadata = await client.getArtifact(artifactId);
        if (metadata) {
          const isOutdated = compareSemver(entry.version, metadata.latest) < 0;
          results.push({
            artifactId,
            current: entry.version,
            latest: metadata.latest,
            isOutdated,
          });
        }
      } catch {
        // Skip artifacts that can't be checked
      }
    }

    spin.stop();

    if (results.length === 0) {
      info("Could not check any artifacts");
      process.exit(0);
    }

    const outdated = results.filter(r => r.isOutdated);
    const upToDate = results.filter(r => !r.isOutdated);

    log("");

    if (outdated.length > 0) {
      log(colors.bold("Outdated artifacts:"));
      log("");

      // Calculate column widths
      const maxIdLen = Math.max(...outdated.map(r => r.artifactId.length), 8);
      const maxCurrentLen = Math.max(...outdated.map(r => r.current.length), 7);

      // Header
      log(
        `  ${colors.dim("Artifact".padEnd(maxIdLen))}  ` +
        `${colors.dim("Current".padEnd(maxCurrentLen))}  ` +
        `${colors.dim("Latest")}`
      );

      for (const result of outdated) {
        log(
          `  ${result.artifactId.padEnd(maxIdLen)}  ` +
          `${colors.warning(result.current.padEnd(maxCurrentLen))}  ` +
          `${colors.success(result.latest)}`
        );
      }

      log("");
      info(`Run 'grekt add <artifact>' to update`);
    }

    if (upToDate.length > 0 && outdated.length === 0) {
      log(colors.success("All artifacts are up to date"));
    } else if (upToDate.length > 0) {
      log("");
      log(colors.dim(`${upToDate.length} artifact(s) up to date`));
    }

    log("");
  });
