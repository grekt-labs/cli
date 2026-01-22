import { Command } from "commander";
import { getRegistryCredentials, getCredentialsFromEnv, getRegistryToken } from "#/lib/credentials";
import { createRegistryClient } from "#/lib/registry-client";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  undeprecateVersion,
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

interface UndeprecateOptions {
  registry: string;
  s3?: boolean;
}

export const undeprecateCommand = new Command("undeprecate")
  .description("Remove deprecation from an artifact version")
  .argument("<artifact@version>", "Artifact and version to undeprecate (e.g., @author/name@1.0.0)")
  .option("-r, --registry <name>", "Registry name from credentials.yaml", "default")
  .option("--s3", "Use S3-compatible storage (legacy mode)")
  .action(async (artifactVersion: string, options: UndeprecateOptions) => {
    const parsed = parseArtifactVersion(artifactVersion);
    if (!parsed) {
      error("Invalid format. Use: @author/name@version");
      process.exit(1);
    }

    const { artifactId, version } = parsed;

    if (options.s3) {
      await undeprecateS3(artifactId, version, options.registry);
    } else {
      await undeprecateApi(artifactId, version);
    }
  });

/**
 * Undeprecate using the new API-based registry
 */
async function undeprecateApi(artifactId: string, version: string): Promise<void> {
  const token = getRegistryToken();

  if (!token) {
    error("Not logged in");
    info("Run 'grekt login' first");
    log("");
    log(colors.dim("For S3-compatible storage, use --s3 flag"));
    process.exit(1);
  }

  const client = createRegistryClient();
  const spin = spinner("Removing deprecation...");
  spin.start();

  try {
    await client.undeprecate(artifactId, version);
    spin.stop();
    success(`Removed deprecation from ${artifactId}@${version}`);
  } catch (err) {
    spin.stop();
    error(err instanceof Error ? err.message : "Failed to undeprecate");
    process.exit(1);
  }
}

/**
 * Undeprecate using S3-compatible storage (legacy mode)
 */
async function undeprecateS3(artifactId: string, version: string, registryName: string): Promise<void> {
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

  const metadata = await getArtifactMetadata(credentials, artifactId);
  if (!metadata) {
    spin.stop();
    error(`Metadata not found for ${artifactId}`);
    process.exit(1);
  }

  if (!metadata.deprecated[version]) {
    spin.stop();
    info(`Version ${version} is not deprecated`);
    process.exit(0);
  }

  spin.text = "Updating metadata...";

  const updated = undeprecateVersion(metadata, version);
  await saveArtifactMetadata(credentials, updated);

  spin.stop();
  success(`Removed deprecation from ${artifactId}@${version}`);
}
