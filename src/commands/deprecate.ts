import { Command } from "commander";
import { parseArtifactId, type DefaultRegistryOperations } from "@grekt-labs/cli-engine";
import { resolveRegistry, createRegistryClient } from "#/registry/factory/factory";
import { getLocalConfig } from "#/config/project/project";
import { isAuthenticated } from "#/auth/session/session";
import { requireInitialized } from "#/shared/guards/guards";
import { getS3CredentialsFromEnv } from "#/registry/publishers/s3-publisher";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  versionExists,
  deprecateVersion,
} from "#/registry/metadata/metadata";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";
import { parseArtifactVersion } from "#/artifact/version-parser/version-parser";

interface DeprecateCommandOptions {
  message: string;
  s3?: boolean;
}

interface DeprecateOperationParams {
  artifactId: string;
  version: string;
  message: string;
  projectRoot: string;
}

export const deprecateCommand = new Command("deprecate")
  .description("Deprecate an artifact version (API and S3 only, not supported for GitLab/GitHub)")
  .argument("[artifact@version]", "Artifact and version to deprecate (e.g., @author/name@1.0.0)")
  .option("-m, --message <message>", "Deprecation message", "This version is deprecated")
  .option("--s3", "Use S3-compatible storage (legacy mode, env vars only)")
  .action(async (artifactVersion: string | undefined, options: DeprecateCommandOptions) => {
    const projectRoot = process.cwd();

    if (!artifactVersion) {
      error("Artifact and version required. Usage:");
      info("  grekt deprecate @author/name@1.0.0");
      info("  grekt deprecate @author/name@1.0.0 -m 'Use v2 instead'");
      process.exit(1);
    }

    requireInitialized(projectRoot);

    const parsed = parseArtifactVersion(artifactVersion);
    if (!parsed) {
      error("Invalid format. Use: @author/name@version");
      process.exit(1);
    }

    const { artifactId, version } = parsed;

    const params: DeprecateOperationParams = { artifactId, version, message: options.message, projectRoot };

    if (options.s3) {
      await deprecateS3(params);
    } else {
      await deprecateApi(params);
    }
  });

/**
 * Deprecate using the API-based registry
 */
async function deprecateApi(params: DeprecateOperationParams): Promise<void> {
  const { artifactId, version, message, projectRoot } = params;
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

  const spin = spinner("Deprecating version...");
  spin.start();

  try {
    await client.deprecate(artifactId, { version, message });
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
async function deprecateS3(params: DeprecateOperationParams): Promise<void> {
  const { artifactId, version, message } = params;
  const credentials = getS3CredentialsFromEnv();

  if (!credentials) {
    error("No S3 credentials found");
    info("Set GREKT_STORAGE_* environment variables for S3 mode");
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
