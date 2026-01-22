import { Command } from "commander";
import { getRegistryCredentials, getCredentialsFromEnv } from "#/lib/credentials";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  versionExists,
  deprecateVersion,
} from "#/lib/metadata";
import { success, error, info, log, spinner } from "#/utils/ui";

function parseArtifactVersion(input: string): { artifactId: string; version: string } | null {
  const match = input.match(/^(@[^@]+)@(.+)$/);
  if (!match) return null;
  return { artifactId: match[1], version: match[2] };
}

export const deprecateCommand = new Command("deprecate")
  .description("Deprecate an artifact version")
  .argument("<artifact@version>", "Artifact and version to deprecate (e.g., @author/name@1.0.0)")
  .option("-m, --message <message>", "Deprecation message", "This version is deprecated")
  .option("-r, --registry <name>", "Registry name from credentials.yaml", "default")
  .action(async (artifactVersion: string, options: { message: string; registry: string }) => {
    const parsed = parseArtifactVersion(artifactVersion);
    if (!parsed) {
      error("Invalid format. Use: @author/name@version");
      process.exit(1);
    }

    const { artifactId, version } = parsed;

    let credentials = getCredentialsFromEnv();
    if (!credentials) {
      credentials = getRegistryCredentials(options.registry);
    }

    if (!credentials) {
      error("No registry credentials found");
      process.exit(1);
    }

    const spin = spinner("Checking artifact...");
    spin.start();

    const exists = await versionExists(credentials, artifactId, version);
    if (!exists) {
      spin.stop();
      error(`Version ${version} does not exist for ${artifactId}`);
      process.exit(1);
    }

    const metadata = await getArtifactMetadata(credentials, artifactId);
    if (!metadata) {
      spin.stop();
      error(`Metadata not found for ${artifactId}`);
      process.exit(1);
    }

    if (metadata.deprecated[version]) {
      spin.stop();
      info(`Version ${version} is already deprecated`);
      log(`  Message: ${metadata.deprecated[version]}`);
      process.exit(0);
    }

    spin.text = "Updating metadata...";

    const updated = deprecateVersion(metadata, version, options.message);
    await saveArtifactMetadata(credentials, updated);

    spin.stop();
    success(`Deprecated ${artifactId}@${version}`);
    log(`  Message: ${options.message}`);
  });
