import { Command } from "commander";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { parse } from "yaml";
import { getRegistryCredentials, getCredentialsFromEnv, getCredentialsPath } from "#/lib/credentials";
import { createRegistryClient } from "#/lib/registry-client";
import { isAuthenticated } from "#/lib/supabase";
import { getLocalConfig, getLocalConfigPath } from "#/lib/config";
import {
  resolveRegistry,
  createRegistryClient as createAbstractRegistryClient,
} from "#/lib/registry";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  versionExists,
  createMetadata,
  updateMetadataVersion,
} from "#/lib/metadata";
import { success, error, info, log, colors, spinner } from "#/utils/ui";

interface PublishOptions {
  registry: string;
  local?: boolean;
  output?: string;
  s3?: boolean;
}

export const publishCommand = new Command("publish")
  .description("Publish an artifact to a registry")
  .argument("<path>", "Path to artifact directory")
  .option("-r, --registry <name>", "Registry name from credentials.yaml", "default")
  .option("--local", "Only create tarball locally (no upload)")
  .option("-o, --output <path>", "Output path for tarball (with --local)")
  .option("--s3", "Use S3-compatible storage (legacy mode)")
  .action(async (artifactPath: string, options: PublishOptions) => {
    const fullPath = resolve(artifactPath);

    if (!existsSync(fullPath)) {
      error(`Artifact not found: ${fullPath}`);
      process.exit(1);
    }

    const manifestPath = join(fullPath, "grekt.yaml");
    if (!existsSync(manifestPath)) {
      error(`Missing grekt.yaml in ${fullPath}`);
      process.exit(1);
    }

    const manifest = parse(readFileSync(manifestPath, "utf-8"));
    const artifactId = `@${manifest.author}/${manifest.name}`;

    log(colors.bold(`\nPublishing ${artifactId}@${manifest.version}...\n`));

    // Create tarball
    const tarballName = `${artifactId.replace("/", "-")}.tar.gz`;
    const outputPath = options.output || `/tmp/${tarballName}`;
    const artifactDir = basename(fullPath);
    const parentDir = dirname(fullPath);

    execSync(`tar -czf ${outputPath} -C ${parentDir} ${artifactDir}`, {
      stdio: "pipe",
    });

    success(`Created tarball: ${tarballName}`);

    // If local only, stop here
    if (options.local) {
      log(`\n  Output: ${outputPath}`);
      info("\nUpload manually to your registry or use without --local to publish");
      return;
    }

    // Determine publish mode
    // Priority: --s3 flag > custom registry config > default API
    if (options.s3) {
      await publishToS3(artifactId, manifest.version, outputPath, options.registry);
    } else {
      // Check for custom registry configuration
      const scope = `@${manifest.author}`;
      const localConfig = getLocalConfig(process.cwd());
      const registry = resolveRegistry(scope, localConfig);

      if (registry.type !== "default") {
        // Use custom registry (GitLab, GitHub, etc.)
        await publishToCustomRegistry(artifactId, manifest.version, outputPath, scope, registry);
      } else {
        // Use default API-based registry (Supabase)
        await publishToApi(artifactId, manifest.version, outputPath);
      }
    }
  });

/**
 * Publish using the new API-based registry
 */
async function publishToApi(artifactId: string, version: string, tarballPath: string): Promise<void> {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    unlinkSync(tarballPath);
    error("Not logged in");
    info("Run 'grekt login' first");
    log("");
    log(colors.dim("For S3-compatible storage, use --s3 flag"));
    process.exit(1);
  }

  const client = createRegistryClient();

  // Check if version already exists
  const checkSpin = spinner("Checking if version exists...");
  checkSpin.start();

  try {
    const exists = await client.versionExists(artifactId, version);
    checkSpin.stop();

    if (exists) {
      unlinkSync(tarballPath);
      error(`Version ${version} already exists for ${artifactId}`);
      info("Bump the version in grekt.yaml and try again");
      process.exit(1);
    }
  } catch {
    checkSpin.stop();
    // If we can't check, continue anyway (might be a new artifact)
  }

  // Get upload URL from API
  const spin = spinner("Requesting upload URL...");
  spin.start();

  try {
    const { uploadUrl } = await client.publish(artifactId, version);
    spin.text = "Uploading...";

    // Upload tarball to signed URL
    const body = readFileSync(tarballPath);
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body,
      headers: { "Content-Type": "application/gzip" },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    spin.stop();
    unlinkSync(tarballPath);

    log("");
    success(`Published ${artifactId}@${version}`);
    log(`\n  Install with: grekt add ${artifactId}@${version}\n`);
  } catch (err) {
    spin.stop();
    unlinkSync(tarballPath);
    error(`Publish failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}

/**
 * Publish using custom registry (GitLab, GitHub, etc.)
 */
async function publishToCustomRegistry(
  artifactId: string,
  version: string,
  tarballPath: string,
  scope: string,
  registry: ReturnType<typeof resolveRegistry>
): Promise<void> {
  const client = createAbstractRegistryClient(registry);

  // Check if version already exists
  const checkSpin = spinner("Checking if version exists...");
  checkSpin.start();

  try {
    const exists = await client.versionExists(artifactId, version);
    checkSpin.stop();

    if (exists) {
      unlinkSync(tarballPath);
      error(`Version ${version} already exists for ${artifactId}`);
      info("Bump the version in grekt.yaml and try again");
      process.exit(1);
    }
  } catch {
    checkSpin.stop();
    // If we can't check, continue anyway (might be a new artifact)
  }

  // Publish
  const spin = spinner(`Publishing to ${registry.type} registry...`);
  spin.start();

  try {
    const result = await client.publish(artifactId, version, tarballPath);

    spin.stop();

    if (!result.success) {
      unlinkSync(tarballPath);
      error(`Publish failed: ${result.error || "Unknown error"}`);
      log("");
      if (registry.type === "gitlab" && !registry.token) {
        info("GitLab registry requires authentication.");
        log("");
        log(colors.dim("  Configure token in one of these ways:"));
        log(`  1. Add token to ${getLocalConfigPath()}:`);
        log(`     registries:`);
        log(`       "${scope}":`);
        log(`         type: gitlab`);
        log(`         project: your/project`);
        log(`         token: glpat-xxx`);
        log("");
        log(`  2. Set environment variable: GREKT_TOKEN_${scope.slice(1).toUpperCase()}`);
        log(`  3. Set GITLAB_TOKEN environment variable`);
      }
      process.exit(1);
    }

    unlinkSync(tarballPath);

    log("");
    success(`Published ${artifactId}@${version}`);
    if (result.url) {
      log(`  URL: ${result.url}`);
    }
    log(`\n  Install with: grekt add ${artifactId}@${version}\n`);
  } catch (err) {
    spin.stop();
    unlinkSync(tarballPath);
    error(`Publish failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}

/**
 * Publish using S3-compatible storage (legacy mode)
 */
async function publishToS3(artifactId: string, version: string, tarballPath: string, registryName: string): Promise<void> {
  // Get credentials (env vars take precedence, then credentials file)
  let credentials = getCredentialsFromEnv();

  if (!credentials) {
    credentials = getRegistryCredentials(registryName);
  }

  if (!credentials) {
    unlinkSync(tarballPath);
    error("No S3 credentials found");
    log("");
    info("Configure credentials in one of these ways:");
    log("");
    log(colors.dim("  1. Environment variables:"));
    log("     GREKT_STORAGE_ENDPOINT=https://...");
    log("     GREKT_STORAGE_ACCESS_KEY_ID=...");
    log("     GREKT_STORAGE_SECRET_ACCESS_KEY=...");
    log("     GREKT_STORAGE_BUCKET=...");
    log("");
    log(colors.dim(`  2. Credentials file (${getCredentialsPath()}):`));
    log("     default:");
    log("       type: s3");
    log("       endpoint: https://...");
    log("       accessKeyId: ...");
    log("       secretAccessKey: ...");
    log("       bucket: ...");
    log("       publicUrl: https://... (optional)");
    log("");
    log(colors.dim("  3. Use --local to create tarball without uploading"));
    process.exit(1);
  }

  // Check if version already exists
  const checkSpin = spinner("Checking if version exists...");
  checkSpin.start();

  try {
    const exists = await versionExists(credentials, artifactId, version);
    checkSpin.stop();

    if (exists) {
      unlinkSync(tarballPath);
      error(`Version ${version} already exists for ${artifactId}`);
      info("Bump the version in grekt.yaml and try again");
      process.exit(1);
    }
  } catch {
    checkSpin.stop();
    // If we can't check, continue anyway (might be a new artifact)
  }

  // Upload to S3-compatible storage
  const spin = spinner("Uploading...");
  spin.start();

  const client = new S3Client({
    region: "auto",
    endpoint: credentials.endpoint,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  const key = `artifacts/${artifactId}/${version}.tar.gz`;
  const body = readFileSync(tarballPath);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: credentials.bucket,
        Key: key,
        Body: body,
        ContentType: "application/gzip",
      })
    );

    spin.stop();
    success(`Uploaded: ${key}`);

    // Update metadata
    const metaSpin = spinner("Updating metadata...");
    metaSpin.start();

    let metadata = await getArtifactMetadata(credentials, artifactId);
    if (metadata) {
      metadata = updateMetadataVersion(metadata, version);
    } else {
      metadata = createMetadata(artifactId, version);
    }
    await saveArtifactMetadata(credentials, metadata);

    metaSpin.stop();
    success("Metadata updated");

    unlinkSync(tarballPath);

    log("");
    success(`Published ${artifactId}@${version}`);

    if (credentials.publicUrl) {
      log(`  URL: ${credentials.publicUrl}/${key}`);
    }

    log(`\n  Install with: grekt add ${artifactId}@${version}\n`);
  } catch (err) {
    spin.stop();
    unlinkSync(tarballPath);
    error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }
}
