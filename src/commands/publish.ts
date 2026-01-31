import { Command } from "commander";
import { setProjectRoot } from "#/auth/session/session";
import { getLocalConfigPath } from "#/config/project/project";
import {
  createPublisher,
  getPublisherTypeName,
} from "#/registry/publishers/factory";
import { S3Publisher } from "#/registry/publishers/s3-publisher";
import { CustomPublisher } from "#/registry/publishers/custom-publisher";
import { isApiAuthenticated } from "#/registry/publishers/api-publisher";
import type { PublishContext } from "#/registry/publishers/publisher.types";
import { createTarball, removeTarball } from "#/artifact/tarball/tarball";
import { validateArtifact } from "#/artifact/validation/validation";
import { CATEGORIES } from "@grekt-labs/cli-engine";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";

const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 5;

interface PublishOptions {
  s3?: boolean;
}

function logComponentSummary(
  artifactId: string,
  version: string,
  keywords: string[],
  scanned: { agent?: unknown; skills: unknown[]; commands: unknown[]; mcps: unknown[]; rules: unknown[] },
  componentCount: number
): void {
  log(colors.bold(`\nPublishing ${artifactId}@${version}...`));
  log(colors.dim(`  Keywords: ${keywords.join(", ")}`));
  log(colors.dim(`  Components: ${componentCount}`));
  if (scanned.agent) log(colors.dim(`    - 1 agent`));
  if (scanned.skills.length > 0) log(colors.dim(`    - ${scanned.skills.length} skill(s)`));
  if (scanned.commands.length > 0) log(colors.dim(`    - ${scanned.commands.length} command(s)`));
  if (scanned.mcps.length > 0) log(colors.dim(`    - ${scanned.mcps.length} mcp(s)`));
  if (scanned.rules.length > 0) log(colors.dim(`    - ${scanned.rules.length} rule(s)`));
  log("");
}

function showKeywordsExample(): void {
  log("");
  log(colors.dim("  Example:"));
  log(colors.dim("    keywords:"));
  log(colors.dim("      - git"));
  log(colors.dim("      - commit"));
  log(colors.dim("      - automation"));
}

function showFrontmatterExample(): void {
  log("");
  log(colors.dim("  Example frontmatter for .md files:"));
  log(colors.dim("    ---"));
  log(colors.dim(`    grk-type: ${CATEGORIES[0]}`));
  log(colors.dim("    grk-name: My Component"));
  log(colors.dim("    grk-description: What this component does"));
  log(colors.dim("    ---"));
  log("");
  log(colors.dim(`  Valid types: ${CATEGORIES.join(", ")}`));
}

export const publishCommand = new Command("publish")
  .description("Publish an artifact to a registry")
  .argument("[path]", "Path to artifact directory (default: current directory)", ".")
  .option("--s3", "Use S3-compatible storage (legacy mode, env vars only)")
  .action(async (artifactPath: string, options: PublishOptions) => {
    const projectRoot = process.cwd();

    const result = validateArtifact(artifactPath, projectRoot, {
      requireKeywords: { min: MIN_KEYWORDS, max: MAX_KEYWORDS },
    });

    if (!result.success) {
      error(result.error.message);
      if (result.error.details) {
        for (const detail of result.error.details) {
          info(detail);
        }
      }
      if (result.error.type === "keywords") {
        showKeywordsExample();
      }
      if (result.error.type === "no-components") {
        showFrontmatterExample();
      }
      process.exit(1);
    }

    const { artifact } = result;

    setProjectRoot(projectRoot);

    logComponentSummary(
      artifact.artifactId,
      artifact.manifest.version,
      artifact.manifest.keywords ?? [],
      artifact.scanned,
      artifact.componentCount
    );

    const tarballResult = createTarball({
      artifactPath: artifact.fullPath,
      artifactId: artifact.artifactId,
      projectRoot,
    });

    if (!tarballResult.success || !tarballResult.path) {
      error(`Failed to create tarball: ${tarballResult.error}`);
      process.exit(1);
    }

    success(`Created tarball: ${tarballResult.filename}`);

    const publisher = createPublisher({
      s3: options.s3,
      scope: artifact.scope,
      projectRoot,
    });

    const ctx: PublishContext = {
      artifactId: artifact.artifactId,
      version: artifact.manifest.version,
      tarballPath: tarballResult.path,
      scope: artifact.scope,
      projectRoot,
    };

    if (publisher instanceof S3Publisher && !publisher.hasCredentials()) {
      removeTarball(tarballResult.path);
      showS3CredentialsHelp();
      process.exit(1);
    }

    if (publisher.type === "api") {
      const authenticated = await isApiAuthenticated();
      if (!authenticated) {
        removeTarball(tarballResult.path);
        error("Not logged in");
        info("Run 'grekt login' first");
        log("");
        log(colors.dim("For S3-compatible storage, use --s3 flag"));
        process.exit(1);
      }
    }

    const checkSpin = spinner("Checking if version exists...");
    checkSpin.start();

    try {
      const exists = await publisher.versionExists(ctx);
      checkSpin.stop();

      if (exists) {
        removeTarball(tarballResult.path);
        error(`Version ${artifact.manifest.version} already exists for ${artifact.artifactId}`);
        info("Bump the version in grekt.yaml and try again");
        process.exit(1);
      }
    } catch (err) {
      checkSpin.stop();
      // Version check failed, but we continue with publish attempt
      // The publish step will provide a more specific error if there's an issue
      const message = err instanceof Error ? err.message : "Unknown error";
      info(`Could not verify version existence: ${message}`);
    }

    const publisherName = getPublisherTypeName(publisher);
    const spin = spinner(`Publishing to ${publisherName}...`);
    spin.start();

    const publishResult = await publisher.publish(ctx);
    spin.stop();

    if (!publishResult.success) {
      removeTarball(tarballResult.path);
      error(`Publish failed: ${publishResult.error}`);

      if (publisher instanceof CustomPublisher) {
        const registry = publisher.getRegistry();
        if (registry.type === "gitlab" && !registry.token) {
          showGitLabHelp(artifact.scope);
        }
      }

      process.exit(1);
    }

    removeTarball(tarballResult.path);

    log("");
    success(`Published ${artifact.artifactId}@${artifact.manifest.version}`);
    if (publishResult.url) {
      log(`  URL: ${publishResult.url}`);
    }
    log(`\n  Install with: grekt add ${artifact.artifactId}@${artifact.manifest.version}\n`);
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
  log(colors.dim("Use 'grekt pack' to create tarball without uploading"));
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
  log(`  2. Set GITLAB_TOKEN environment variable`);
}
