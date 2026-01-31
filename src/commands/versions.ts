import { Command } from "commander";
import { getS3CredentialsFromEnv } from "#/registry/publishers/s3-publisher";
import { getArtifactMetadata, listVersions } from "#/registry/metadata/metadata";
import { error, info, log, colors, spinner } from "#/shared/ui/ui";

export const versionsCommand = new Command("versions")
  .description("List all versions of an artifact (requires S3 credentials)")
  .argument("[artifact]", "Artifact ID (e.g., @author/name)")
  .action(async (artifactId: string | undefined) => {
    if (!artifactId) {
      error("Artifact ID required. Usage:");
      info("  grekt versions @author/name");
      process.exit(1);
    }

    if (!artifactId.startsWith("@")) {
      error("Invalid artifact ID. Use: @author/name");
      process.exit(1);
    }

    const credentials = getS3CredentialsFromEnv();
    if (!credentials) {
      error("No S3 credentials found");
      info("Set GREKT_STORAGE_* environment variables for S3 mode");
      process.exit(1);
    }

    const spin = spinner("Fetching versions...");
    spin.start();

    let metadata: Awaited<ReturnType<typeof getArtifactMetadata>> = null;
    let versions: Awaited<ReturnType<typeof listVersions>> = [];

    try {
      [metadata, versions] = await Promise.all([
        getArtifactMetadata(credentials, artifactId),
        listVersions(credentials, artifactId),
      ]);
    } catch (err) {
      spin.stop();
      error(`Failed to fetch versions: ${err instanceof Error ? err.message : "Unknown error"}`);
      process.exit(1);
    }

    spin.stop();

    if (versions.length === 0) {
      error(`No versions found for ${artifactId}`);
      process.exit(1);
    }

    log("");
    log(colors.bold(artifactId));
    if (metadata) {
      log(colors.dim(`  latest: ${metadata.latest}`));
    }
    log("");

    for (const version of versions) {
      const isLatest = metadata?.latest === version;
      const deprecationMsg = metadata?.deprecated[version];

      let line = `  ${version}`;
      if (isLatest) {
        line += colors.success(" (latest)");
      }
      if (deprecationMsg) {
        line += colors.warning(` ⚠ deprecated: ${deprecationMsg}`);
      }

      log(line);
    }

    log("");
  });
