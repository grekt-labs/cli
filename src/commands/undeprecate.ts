import { Command } from "commander";
import { parseArtifactId, type DefaultRegistryOperations } from "@grekt-labs/cli-engine";
import { resolveRegistry, createRegistryClient } from "#/registry/factory/factory";
import { getLocalConfig } from "#/config/project/project";
import { isAuthenticated, setProjectRoot } from "#/auth/session/session";
import { requireInitialized } from "#/shared/guards/guards";
import { getS3CredentialsFromEnv } from "#/registry/publishers/s3-publisher";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  undeprecateVersion,
} from "#/registry/metadata/metadata";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";

/**
 * Parse "@author/name@version" format.
 * Returns null if format is invalid.
 */
function parseArtifactVersion(input: string): { artifactId: string; version: string } | null {
  const ARTIFACT_AT_VERSION = /^(?<artifactId>@[^@]+)@(?<version>.+)$/;

  const match = input.match(ARTIFACT_AT_VERSION);
  if (!match?.groups?.artifactId || !match?.groups?.version) return null;

  return {
    artifactId: match.groups.artifactId,
    version: match.groups.version,
  };
}

interface UndeprecateOptions {
  s3?: boolean;
}

export const undeprecateCommand = new Command("undeprecate")
  .description("Remove deprecation from an artifact version (API and S3 only, not supported for GitLab/GitHub)")
  .argument("[artifact@version]", "Artifact and version to undeprecate (e.g., @author/name@1.0.0)")
  .option("--s3", "Use S3-compatible storage (legacy mode, env vars only)")
  .action(async (artifactVersion: string | undefined, options: UndeprecateOptions) => {
    const projectRoot = process.cwd();

    if (!artifactVersion) {
      error("Artifact and version required. Usage:");
      info("  grekt undeprecate @author/name@1.0.0");
      process.exit(1);
    }

    requireInitialized(projectRoot);

    // Set project root for session operations
    setProjectRoot(projectRoot);

    const parsed = parseArtifactVersion(artifactVersion);
    if (!parsed) {
      error("Invalid format. Use: @author/name@version");
      process.exit(1);
    }

    const { artifactId, version } = parsed;

    if (options.s3) {
      await undeprecateS3(artifactId, version);
    } else {
      await undeprecateApi(artifactId, version, projectRoot);
    }
  });

/**
 * Undeprecate using the API-based registry
 */
async function undeprecateApi(artifactId: string, version: string, projectRoot: string): Promise<void> {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    error("Not logged in");
    info("Run 'grekt login' first");
    log("");
    log(colors.dim("For S3-compatible storage, use --s3 flag"));
    process.exit(1);
  }

  const localConfig = getLocalConfig(projectRoot);
  const { scope } = parseArtifactId(artifactId);
  const registry = resolveRegistry(scope, localConfig, projectRoot);
  const client = createRegistryClient(registry) as ReturnType<typeof createRegistryClient> & DefaultRegistryOperations;

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
async function undeprecateS3(artifactId: string, version: string): Promise<void> {
  const credentials = getS3CredentialsFromEnv();

  if (!credentials) {
    error("No S3 credentials found");
    info("Set GREKT_STORAGE_* environment variables for S3 mode");
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
