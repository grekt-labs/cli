import { Command } from "commander";
import { getRegistryCredentials, getCredentialsFromEnv, getRegistryToken } from "#/lib/credentials";
import { createRegistryClient } from "#/lib/registry-client";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  versionExists,
  deprecateVersion,
} from "#/lib/metadata";
import { success, error, info, log, colors, spinner } from "#/utils/ui";

/**
 * Parse "@author/name@version" format.
 * Returns null if format is invalid.
 */
function parseArtifactVersion(input: string): { artifactId: string; version: string } | null {
  // @scope/name@version (version required)
  const ARTIFACT_AT_VERSION = /^(?<artifactId>@[^@]+)@(?<version>.+)$/;

  const match = input.match(ARTIFACT_AT_VERSION);
  if (!match?.groups?.artifactId || !match?.groups?.version) return null;

  return {
    artifactId: match.groups.artifactId,
    version: match.groups.version,
  };
}

interface DeprecateOptions {
  message: string;
  registry: string;
  s3?: boolean;
}

export const deprecateCommand = new Command("deprecate")
  .description("Deprecate an artifact version")
  .argument("<artifact@version>", "Artifact and version to deprecate (e.g., @author/name@1.0.0)")
  .option("-m, --message <message>", "Deprecation message", "This version is deprecated")
  .option("-r, --registry <name>", "Registry name from credentials.yaml", "default")
  .option("--s3", "Use S3-compatible storage (legacy mode)")
  .action(async (artifactVersion: string, options: DeprecateOptions) => {
    const parsed = parseArtifactVersion(artifactVersion);
    if (!parsed) {
      error("Invalid format. Use: @author/name@version");
      process.exit(1);
    }

    const { artifactId, version } = parsed;

    if (options.s3) {
      await deprecateS3(artifactId, version, options.message, options.registry);
    } else {
      await deprecateApi(artifactId, version, options.message);
    }
  });

/**
 * Deprecate using the new API-based registry
 */
async function deprecateApi(artifactId: string, version: string, message: string): Promise<void> {
  const token = getRegistryToken();

  if (!token) {
    error("Not logged in");
    info("Run 'grekt login' first");
    log("");
    log(colors.dim("For S3-compatible storage, use --s3 flag"));
    process.exit(1);
  }

  const client = createRegistryClient();
  const spin = spinner("Deprecating version...");
  spin.start();

  try {
    await client.deprecate(artifactId, version, message);
    spin.stop();
    success(`Deprecated ${artifactId}@${version}`);
    log(`  Message: ${message}`);
  } catch (err) {
    spin.stop();
    error(err instanceof Error ? err.message : "Failed to deprecate");
    process.exit(1);
  }
}

/**
 * Deprecate using S3-compatible storage (legacy mode)
 */
async function deprecateS3(artifactId: string, version: string, message: string, registryName: string): Promise<void> {
  let credentials = getCredentialsFromEnv();
  if (!credentials) {
    credentials = getRegistryCredentials(registryName);
  }

  if (!credentials) {
    error("No S3 credentials found");
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

  const updated = deprecateVersion(metadata, version, message);
  await saveArtifactMetadata(credentials, updated);

  spin.stop();
  success(`Deprecated ${artifactId}@${version}`);
  log(`  Message: ${message}`);
}
