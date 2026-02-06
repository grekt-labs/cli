import { Command } from "commander";
import { setProjectRoot } from "#/auth/session/session";
import { getLocalConfigPath, getLocalConfig } from "#/config/project/project";
import {
  createPublisher,
  getPublisherTypeName,
} from "#/registry/publishers/factory";
import { S3Publisher } from "#/registry/publishers/s3-publisher";
import { CustomPublisher } from "#/registry/publishers/custom-publisher";
import { isApiAuthenticated } from "#/registry/publishers/api-publisher";
import type { PublishContext } from "#/registry/publishers/publisher.types";
import type { Publisher } from "#/registry/publishers/publisher.types";
import { createTarball, removeTarball } from "#/artifact/tarball/tarball";
import { validateArtifact } from "#/artifact/validation/validation";
import {
  CATEGORIES,
  generateComponents,
  isWorkspaceRoot,
  compareSemver,
} from "@grekt-labs/cli-engine";
import { success, error, info, log, colors, spinner } from "#/shared/ui/ui";
import { loadWorkspace } from "./workspace";
import { fs } from "#/context";

const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 5;

interface PublishOptions {
  s3?: boolean;
  changed?: boolean;
  dryRun?: boolean;
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
  .option("--changed", "Publish only artifacts with version > registry (workspace mode)")
  .option("--dry-run", "Show what would be published without actually publishing")
  .action(async (artifactPath: string, options: PublishOptions) => {
    const cwd = process.cwd();

    // --changed mode: publish all workspace artifacts where local > registry
    if (options.changed) {
      await handleChangedMode(cwd, options);
      return;
    }

    // Standard single artifact publish
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
    const publisher = createPublisher({
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
 * Publish a single artifact.
 */
async function publishSingleArtifact(
  artifactPath: string,
  projectRoot: string,
  options: { s3?: boolean },
  silent: boolean = false
): Promise<void> {
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
    throw new Error(result.error.message);
  }

  const { artifact } = result;

  // Verify artifact has a scope (required for publishing)
  if (!artifact.scope) {
    error("Cannot publish: artifact name must include scope");
    log("");
    info("Update your grekt.yaml:");
    log(colors.dim("  name: \"@your-scope/artifact-name\""));
    log("");
    log(colors.dim("The scope determines which registry to use for publishing."));
    throw new Error("No scope");
  }

  setProjectRoot(projectRoot);

  if (!silent) {
    logComponentSummary(
      artifact.artifactId,
      artifact.manifest.version,
      artifact.manifest.keywords ?? [],
      artifact.scanned,
      artifact.componentCount
    );
  }

  const components = generateComponents(artifact.scanned);

  const tarballResult = createTarball({
    artifactPath: artifact.fullPath,
    artifactId: artifact.artifactId,
    projectRoot,
    components,
  });

  if (!tarballResult.success || !tarballResult.path) {
    throw new Error(`Failed to create tarball: ${tarballResult.error}`);
  }

  if (!silent) {
    success(`Created tarball: ${tarballResult.filename}`);
  }

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
    description: artifact.manifest.description,
    keywords: artifact.manifest.keywords,
  };

  if (publisher instanceof S3Publisher && !publisher.hasCredentials()) {
    removeTarball(tarballResult.path);
    showS3CredentialsHelp();
    throw new Error("No S3 credentials");
  }

  // Check if using default registry (no config found for this scope)
  if (publisher.type === "api") {
    const authenticated = await isApiAuthenticated();
    if (!authenticated) {
      removeTarball(tarballResult.path);
      error("Not logged in. Run 'grekt login' first to publish to the default registry.");
      throw new Error("Not authenticated");
    }
  }

  if (!silent) {
    const checkSpin = spinner("Checking if version exists...");
    checkSpin.start();

    try {
      const exists = await publisher.versionExists(ctx);
      checkSpin.stop();

      if (exists) {
        removeTarball(tarballResult.path);
        error(`Version ${artifact.manifest.version} already exists for ${artifact.artifactId}`);
        info("Bump the version in grekt.yaml and try again");
        throw new Error("Version exists");
      }
    } catch (err) {
      checkSpin.stop();
      if (err instanceof Error && err.message === "Version exists") {
        throw err;
      }
      // Version check failed, but we continue with publish attempt
      const message = err instanceof Error ? err.message : "Unknown error";
      info(`Could not verify version existence: ${message}`);
    }
  }

  const publisherName = getPublisherTypeName(publisher);
  const spin = silent ? null : spinner(`Publishing to ${publisherName}...`);
  spin?.start();

  const publishResult = await publisher.publish(ctx);
  spin?.stop();

  if (!publishResult.success) {
    removeTarball(tarballResult.path);

    if (publisher instanceof CustomPublisher) {
      const registry = publisher.getRegistry();
      if (registry.type === "gitlab" && !registry.token) {
        showGitLabHelp(artifact.scope, projectRoot);
      }
    }

    throw new Error(`Publish failed: ${publishResult.error}`);
  }

  removeTarball(tarballResult.path);

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

function showRegistryConfigHelp(scope: string | null, projectRoot: string): void {
  const localConfig = getLocalConfig(projectRoot);
  const configuredScopes = localConfig?.registries
    ? Object.keys(localConfig.registries)
    : [];

  if (configuredScopes.length > 0) {
    error(`No registry configured for ${scope}`);
    log("");
    info("Available registries:");
    for (const s of configuredScopes) {
      const entry = localConfig?.registries?.[s];
      if (entry) {
        log(`  ${s} (${entry.type})`);
      }
    }
    log("");
    log(colors.dim(`Check if your artifact scope matches your config.`));
    log(colors.dim(`Config file: ${getLocalConfigPath(projectRoot)}`));
  } else {
    error(`No registry configured for ${scope}`);
    log("");
    info(`Add a registry to ${getLocalConfigPath(projectRoot)}:`);
    log(colors.dim("  registries:"));
    log(colors.dim(`    \"${scope}\":`));
    log(colors.dim("      type: gitlab"));
    log(colors.dim("      project: your-group/your-project"));
    log(colors.dim("      token: your-token"));
    log("");
    log(colors.dim("For S3-compatible storage, use --s3 flag"));
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
