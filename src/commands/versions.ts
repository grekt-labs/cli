import { Command } from "commander";
import { getRegistryCredentials, getCredentialsFromEnv } from "#/lib/credentials";
import { getArtifactMetadata, listVersions } from "#/lib/metadata";
import { error, log, colors, spinner } from "#/utils/ui";

export const versionsCommand = new Command("versions")
  .description("List all versions of an artifact")
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

    const spin = spinner("Fetching versions...");
    spin.start();

    const [metadata, versions] = await Promise.all([
      getArtifactMetadata(credentials, artifactId),
      listVersions(credentials, artifactId),
    ]);

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
