import { Command } from "commander";
import { getLocalConfigPath, getLocalConfig } from "#/config/project/project";
import {
  validateForPublish,
  createArtifactTarball,
  isApproachingSizeLimit,
  createArtifactPublisher,
  verifyPublisherAuth,
  checkVersionExists,
  publishArtifact,
  getPublisherTypeName,
  removeTarball,
  formatBytes,
} from "#/artifact/publish/publish";
import type { ValidationError } from "#/artifact/publish/publish";
import type { PublishContext, Publisher } from "#/registry/publishers/publisher.types";
import { CustomPublisher } from "#/registry/publishers/custom-publisher";
import { RegistryError } from "#/registry/api-client/registry-error";
import { CATEGORIES, isWorkspaceRoot, compareSemver } from "@grekt-labs/cli-engine";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";
import { logComponentSummary } from "./display";
import { loadWorkspace } from "./workspace";
import { fs } from "#/context";

interface PublishOptions {
  s3?: boolean;
  changed?: boolean;
  dryRun?: boolean;
}

export const publishCommand = new Command("publish")
  .description("Publish an artifact to a registry")
  .argument("[path]", "Path to artifact directory (default: current directory)", ".")
  .option("--s3", "Use S3-compatible storage (legacy mode, env vars only)")
  .option("--changed", "Publish only artifacts with version > registry (workspace mode)")
  .option("--dry-run", "Show what would be published without actually publishing")
  .action(async (artifactPath: string, options: PublishOptions) => {
    const cwd = process.cwd();

    if (options.changed) {
      await handleChangedMode(cwd, options);
      return;
    }

    await publishSingleArtifact(artifactPath, cwd, options);
  });

/**
 * Handle --changed mode: publish workspace artifacts where local version > registry.
 */
async function handleChangedMode(cwd: string, options: PublishOptions): Promise<void> {
  if (!isWorkspaceRoot(fs, cwd)) {
    error("--changed requires a workspace (grekt-workspace.yaml not found)");
    info("Run this command from your workspace root");
    process.exit(1);
  }

  const workspace = await loadWorkspace(cwd);

  if (!workspace || workspace.artifacts.length === 0) {
    error("No artifacts found in workspace");
    process.exit(1);
  }

  log("");
  info(`Checking ${workspace.artifacts.length} artifact(s) for changes...`);
  log("");

  const toPublish: Array<{ path: string; name: string; localVersion: string; registryVersion: string | null }> = [];

  for (const artifact of workspace.artifacts) {
    const publisher = createArtifactPublisher({
      s3: options.s3,
      scope: artifact.manifest.name.split("/")[0]!,
      projectRoot: cwd,
    });

    let registryVersion: string | null = null;

    try {
      registryVersion = await publisher.getLatestVersion({
        artifactId: artifact.manifest.name,
        version: artifact.manifest.version,
        tarballPath: "",
        scope: artifact.manifest.name.split("/")[0]!,
        projectRoot: cwd,
        categories: [],
      });
    } catch {
      // Artifact not published yet
    }

    const localVersion = artifact.manifest.version;
    const needsPublish = !registryVersion || compareSemver(localVersion, registryVersion) > 0;

    if (needsPublish) {
      toPublish.push({
        path: artifact.path,
        name: artifact.manifest.name,
        localVersion,
        registryVersion,
      });
      log(`  ${colors.success("↑")} ${artifact.manifest.name} ${localVersion} ${registryVersion ? `(registry: ${registryVersion})` : "(new)"}`);
    } else {
      log(`  ${colors.dim("=")} ${artifact.manifest.name} ${localVersion} (up to date)`);
    }
  }

  log("");

  if (toPublish.length === 0) {
    info("All artifacts are up to date");
    return;
  }

  info(`${toPublish.length} artifact(s) to publish`);

  if (options.dryRun) {
    log("");
    info("Dry run complete (no artifacts were published)");
    return;
  }

  log("");

  let published = 0;
  let failed = 0;

  for (const item of toPublish) {
    try {
      await publishSingleArtifact(item.path, cwd, { s3: options.s3 }, true);
      published++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : "Unknown error";
      error(`Failed to publish ${item.name}: ${message}`);
    }
  }

  log("");
  if (published > 0) {
    success(`Published ${published} artifact(s)`);
  }
  if (failed > 0) {
    error(`Failed to publish ${failed} artifact(s)`);
    process.exit(1);
  }
}

/**
 * Publish a single artifact: validate, check auth, check version, create tarball, publish.
 */
async function publishSingleArtifact(
  artifactPath: string,
  projectRoot: string,
  options: { s3?: boolean },
  silent: boolean = false
): Promise<void> {
  // 1. Validate artifact (cheap, no tarball yet)
  let validated;
  try {
    validated = validateForPublish(artifactPath, projectRoot);
  } catch (err) {
    const validationError = (err as { validationError?: ValidationError }).validationError;
    if (validationError) {
      error(validationError.message);
      if (validationError.details) {
        for (const detail of validationError.details) {
          info(detail);
        }
      }
      if (validationError.type === "keywords") showKeywordsExample();
      if (validationError.type === "no-components") showFrontmatterExample();
      if (validationError.type === "no-scope") showScopeHelp();
    }
    throw err;
  }

  const { artifact, components } = validated;
  const categories = Object.keys(components);

  if (categories.length === 0) {
    error(`Artifact must contain at least one component (${CATEGORIES.join(", ")})`);
    showFrontmatterExample();
    throw new Error("No categories detected");
  }

  // 2. Log component summary
  if (!silent) {
    logComponentSummary({
      artifactId: artifact.artifactId,
      version: artifact.manifest.version,
      action: "Publishing",
      keywords: artifact.manifest.keywords ?? [],
      scanned: artifact.scanned,
      componentCount: artifact.componentCount,
    });
  }

  // 3. Create publisher and verify auth (fail fast before tarball)
  const publisher = createArtifactPublisher({
    s3: options.s3,
    scope: artifact.scope,
    projectRoot,
  });

  const authError = await verifyPublisherAuth(publisher, projectRoot);
  if (authError) {
    if (authError === "no-s3-credentials") showS3CredentialsHelp();
    if (authError === "not-authenticated") showAuthHelp(publisher);
    throw new Error(authError);
  }

  // 4. Check version existence (fail fast before tarball)
  const preCheckCtx: PublishContext = {
    artifactId: artifact.artifactId,
    version: artifact.manifest.version,
    tarballPath: "",
    scope: artifact.scope,
    projectRoot,
    categories,
    description: artifact.manifest.description,
    keywords: artifact.manifest.keywords,
    isPrivate: artifact.manifest.private,
    license: artifact.manifest.license,
    repositoryUrl: artifact.manifest.repository,
  };

  if (!silent) {
    const checkSpin = spinner("Checking if version exists...");
    checkSpin.start();

    const versionCheck = await checkVersionExists(publisher, preCheckCtx);
    checkSpin.stop();

    if (versionCheck.exists) {
      error(`Version ${artifact.manifest.version} already exists for ${artifact.artifactId}`);
      info("Bump the version in grekt.yaml and try again");
      throw new Error("Version exists");
    }

    if (versionCheck.checkFailed) {
      info(`Could not verify version existence: ${versionCheck.error}`);
    }
  }

  // 5. Create tarball (only after all checks pass)
  let tarballPath: string;
  let tarballFilename: string;
  let tarballSize: number;

  try {
    const tarball = createArtifactTarball(validated, projectRoot);
    tarballPath = tarball.tarballPath;
    tarballFilename = tarball.tarballFilename;
    tarballSize = tarball.tarballSize;
  } catch (err) {
    const validationError = (err as { validationError?: ValidationError }).validationError;
    if (validationError?.type === "size-limit") {
      error(validationError.message);
      showSizeHelp();
    }
    throw err;
  }

  if (isApproachingSizeLimit(tarballSize) && !silent) {
    log("");
    log(colors.yellow(`Warning: Artifact is ${formatBytes(tarballSize)} (approaching limit)`));
    log("");
  }

  if (!silent) {
    success(`Created tarball: ${tarballFilename} (${formatBytes(tarballSize)})`);
  }

  // 6. Publish
  const ctx: PublishContext = {
    artifactId: artifact.artifactId,
    version: artifact.manifest.version,
    tarballPath,
    scope: artifact.scope,
    projectRoot,
    categories,
    description: artifact.manifest.description,
    keywords: artifact.manifest.keywords,
    isPrivate: artifact.manifest.private,
    license: artifact.manifest.license,
    repositoryUrl: artifact.manifest.repository,
  };

  const publisherName = getPublisherTypeName(publisher);
  const spin = silent ? null : spinner(`Publishing to ${publisherName}...`);
  spin?.start();

  let publishResult;
  try {
    publishResult = await publishArtifact(publisher, ctx);
  } catch (err) {
    spin?.stop();
    removeTarball(tarballPath);

    if (err instanceof RegistryError) {
      error(err.message);
      showRegistryErrorHint(err);
      throw err;
    }

    throw err;
  }
  spin?.stop();

  if (!publishResult.success) {
    removeTarball(tarballPath);

    if (publisher instanceof CustomPublisher) {
      const registry = publisher.getRegistry();
      if (registry.type === "gitlab" && !registry.token) {
        showGitLabHelp(artifact.scope, projectRoot);
      }
    }

    throw new Error(`Publish failed: ${publishResult.error}`);
  }

  removeTarball(tarballPath);

  if (!silent) {
    log("");
    success(`Published ${artifact.artifactId}@${artifact.manifest.version}`);
    if (publishResult.url) {
      log(`  URL: ${publishResult.url}`);
    }
    log(`\n  Install with: grekt add ${artifact.artifactId}@${artifact.manifest.version}\n`);
  } else {
    success(`Published ${artifact.artifactId}@${artifact.manifest.version}`);
  }
}

// Display helpers

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

function showScopeHelp(): void {
  log("");
  info("Update your grekt.yaml:");
  log(colors.dim('  name: "@your-scope/artifact-name"'));
  log("");
  log(colors.dim("The scope determines which registry to use for publishing."));
}

function showSizeHelp(): void {
  log("");
  info("Tips to reduce size:");
  log(colors.dim("  - Remove unnecessary files"));
  log(colors.dim("  - Check for accidentally included binaries or images"));
  log(colors.dim("  - Use .grektignore to exclude files"));
}

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

const REGISTRY_ERROR_HINTS: Record<string, string> = {
  SCOPE_NOT_FOUND: "Scope not found. Verify it matches your username or organization",
  SCOPE_NOT_OWNED: "You don't have publish permissions for this scope. Contact the organization owner",
  INVALID_CATEGORIES: `Artifact categories are invalid. Valid categories: ${CATEGORIES.join(", ")}`,
};

function showRegistryErrorHint(err: RegistryError): void {
  const hint = REGISTRY_ERROR_HINTS[err.code];
  if (hint) {
    info(hint);
    return;
  }

  if (err.code === "INSERT_FAILED") {
    info(err.details ? `Details: ${err.details}` : "Publish failed at the registry. Try again or check your connection");
    return;
  }

  info("Unexpected registry error. Verify your connection and try again");
}

function showAuthHelp(publisher: Publisher): void {
  if (publisher instanceof CustomPublisher) {
    const registry = publisher.getRegistry();
    error(`Authentication failed for ${registry.type} registry`);
    info("Verify your token and registry URL in .grekt/config.yaml");
  } else {
    error("Not authenticated. Run 'grekt login' or check that the registry is reachable");
  }
}

function showGitLabHelp(scope: string | null, projectRoot: string): void {
  log("");
  info("GitLab registry requires authentication.");
  log("");
  log(colors.dim("  Configure token in one of these ways:"));
  log(`  1. Add token to ${getLocalConfigPath(projectRoot)}:`);
  log(`     registries:`);
  log(`       "${scope ?? "@your-scope"}":`);
  log(`         type: gitlab`);
  log(`         project: your-group/your-project`);
  log(`         token: glpat-xxx`);
  log("");
  log(`  2. Set GITLAB_TOKEN environment variable`);
}
