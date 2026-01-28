import { Command } from "commander";
import { getS3CredentialsFromEnv } from "#/registry/publishers/s3-publisher";
import { getArtifactMetadata, listVersions } from "#/registry/metadata/metadata";
import { error, info as showInfo, log, colors, spinner } from "#/shared/ui/ui";

export const infoCommand = new Command("info")
  .description("Show information about an artifact (requires S3 credentials)")
  .argument("<artifact>", "Artifact ID (e.g., @author/name)")
  .action(async (artifactId: string) => {
    if (!artifactId.startsWith("@")) {
      error("Invalid artifact ID. Use: @author/name");
      process.exit(1);
    }

    const credentials = getS3CredentialsFromEnv();
    if (!credentials) {
      error("No S3 credentials found");
      showInfo("Set GREKT_STORAGE_* environment variables for S3 mode");
      process.exit(1);
    }

    const spin = spinner("Fetching artifact info...");
    spin.start();

    const [metadata, versions] = await Promise.all([
      getArtifactMetadata(credentials, artifactId),
      listVersions(credentials, artifactId),
    ]);

    spin.stop();

    if (!metadata && versions.length === 0) {
      error(`Artifact not found: ${artifactId}`);
      process.exit(1);
    }

    const deprecatedCount = metadata ? Object.keys(metadata.deprecated).length : 0;

    log("");
    log(colors.bold(artifactId));
    log("");
    log(`  ${colors.dim("Latest:")}     ${metadata?.latest || versions[0] || "unknown"}`);
    log(`  ${colors.dim("Versions:")}   ${versions.length} (${deprecatedCount} deprecated)`);
    if (metadata) {
      log(`  ${colors.dim("Created:")}    ${metadata.createdAt.split("T")[0]}`);
      log(`  ${colors.dim("Updated:")}    ${metadata.updatedAt.split("T")[0]}`);
    }
    log("");
  });
