import { Command } from "commander";
import { getRegistryCredentials, getCredentialsFromEnv } from "#/lib/credentials";
import { getArtifactMetadata, listVersions } from "#/lib/metadata";
import { error, log, colors, spinner } from "#/utils/ui";

export const infoCommand = new Command("info")
  .description("Show information about an artifact")
  .argument("<artifact>", "Artifact ID (e.g., @author/name)")
  .option("-r, --registry <name>", "Registry name from credentials.yaml", "default")
  .action(async (artifactId: string, options: { registry: string }) => {
    if (!artifactId.startsWith("@")) {
      error("Invalid artifact ID. Use: @author/name");
      process.exit(1);
    }

    let credentials = getCredentialsFromEnv();
    if (!credentials) {
      credentials = getRegistryCredentials(options.registry);
    }

    if (!credentials) {
      error("No registry credentials found");
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
