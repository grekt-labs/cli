import { Command } from "commander";
import { execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { parse } from "yaml";
import { setProjectRoot } from "#/auth/session/session";
import { isInitialized, getLocalConfigPath } from "#/config/project/project";
import {
  createPublisher,
  getPublisherTypeName,
} from "#/registry/publishers/factory";
import { S3Publisher } from "#/registry/publishers/s3-publisher";
import { CustomPublisher } from "#/registry/publishers/custom-publisher";
import { isApiAuthenticated } from "#/registry/publishers/api-publisher";
import type { PublishContext } from "#/registry/publishers/publisher.types";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";

interface PublishOptions {
  local?: boolean;
  output?: string;
  s3?: boolean;
}

export const publishCommand = new Command("publish")
  .description("Publish an artifact to a registry")
  .argument("<path>", "Path to artifact directory")
  .option("--local", "Only create tarball locally (no upload)")
  .option("-o, --output <path>", "Output path for tarball (with --local)")
  .option("--s3", "Use S3-compatible storage (legacy mode, env vars only)")
  .action(async (artifactPath: string, options: PublishOptions) => {
    const fullPath = resolve(artifactPath);
    const projectRoot = process.cwd();

    // Require project initialization
    if (!isInitialized(projectRoot)) {
      error("Not in a grekt project. Run 'grekt init' first.");
      process.exit(1);
    }

    // Set project root for session operations
    setProjectRoot(projectRoot);

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
    const scope = `@${manifest.author}`;

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

    // Create appropriate publisher
    const publisher = createPublisher({
      s3: options.s3,
      scope,
      projectRoot,
    });

    // Create publish context
    const ctx: PublishContext = {
      artifactId,
      version: manifest.version,
      tarballPath: outputPath,
      scope,
      projectRoot,
    };

    // Check authentication/credentials before proceeding
    if (publisher instanceof S3Publisher && !publisher.hasCredentials()) {
      unlinkSync(outputPath);
      showS3CredentialsHelp();
      process.exit(1);
    }

    if (publisher.type === "api") {
      const authenticated = await isApiAuthenticated();
      if (!authenticated) {
        unlinkSync(outputPath);
        error("Not logged in");
        info("Run 'grekt login' first");
        log("");
        log(colors.dim("For S3-compatible storage, use --s3 flag"));
        process.exit(1);
      }
    }

    // Check if version already exists
    const checkSpin = spinner("Checking if version exists...");
    checkSpin.start();

    try {
      const exists = await publisher.versionExists(ctx);
      checkSpin.stop();

      if (exists) {
        unlinkSync(outputPath);
        error(`Version ${manifest.version} already exists for ${artifactId}`);
        info("Bump the version in grekt.yaml and try again");
        process.exit(1);
      }
    } catch {
      checkSpin.stop();
      // If we can't check, continue anyway (might be a new artifact)
    }

    // Publish
    const publisherName = getPublisherTypeName(publisher);
    const spin = spinner(`Publishing to ${publisherName}...`);
    spin.start();

    const result = await publisher.publish(ctx);
    spin.stop();

    if (!result.success) {
      unlinkSync(outputPath);
      error(`Publish failed: ${result.error}`);

      // Show registry-specific help
      if (publisher instanceof CustomPublisher) {
        const registry = publisher.getRegistry();
        if (registry.type === "gitlab" && !registry.token) {
          showGitLabHelp(scope);
        }
      }

      process.exit(1);
    }

    unlinkSync(outputPath);

    log("");
    success(`Published ${artifactId}@${manifest.version}`);
    if (result.url) {
      log(`  URL: ${result.url}`);
    }
    log(`\n  Install with: grekt add ${artifactId}@${manifest.version}\n`);
  });

function showS3CredentialsHelp(): void {
  error("No S3 credentials found");
  log("");
  info("Configure S3 credentials via environment variables:");
  log("");
  log("  GREKT_STORAGE_ENDPOINT=https://...");
  log("  GREKT_STORAGE_ACCESS_KEY_ID=...");
  log("  GREKT_STORAGE_SECRET_ACCESS_KEY=...");
  log("  GREKT_STORAGE_BUCKET=...");
  log("  GREKT_STORAGE_PUBLIC_URL=https://... (optional)");
  log("");
  log(colors.dim("Or use --local to create tarball without uploading"));
}

function showGitLabHelp(scope: string): void {
  log("");
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
