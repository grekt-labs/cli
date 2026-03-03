import { Command } from "commander";
import { parse } from "yaml";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile, getDirectorySize, fs, http } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import {
  formatBytes,
  estimateTokens,
  ArtifactManifestSchema,
  CATEGORIES,
  createRegistryBrowser,
  type BrowsedArtifact,
} from "@grekt/engine";
import { getLocalConfig } from "#/config/project/project";
import { resolveRegistry } from "#/registry/factory/factory";
import { error, info, log, colors, newline, spinner, warning } from "#/shared/ui/ui";

export const listCommand = new Command("list")
  .alias("ls")
  .description("List installed artifacts or browse a remote registry")
  .argument("[scope]", "Registry scope to list remote artifacts (e.g., @myorg)")
  .option("--json", "Output as JSON")
  .action(async (scope: string | undefined, options: { json?: boolean }) => {
    if (scope) {
      await listRemote(scope, options);
    } else {
      listLocal(options);
    }
  });

function listLocal(options: { json?: boolean }): void {
  const projectRoot = process.cwd();

  requireInitialized(projectRoot);

  const lockfile = getLockfile(projectRoot);
  const artifacts = Object.entries(lockfile.artifacts);

  if (options.json) {
    console.log(JSON.stringify(lockfile, null, 2));
    return;
  }

  if (artifacts.length === 0) {
    info("No artifacts installed");
    info("Run 'grekt add <artifact>' to install artifacts");
    return;
  }

  log(colors.bold("Installed artifacts:"));
  newline();

  let totalSize = 0;

  for (const [name, artifact] of artifacts) {
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${name}`;
    let size = 0;
    let sizeStr = "";

    if (fs.exists(artifactDir)) {
      size = getDirectorySize(artifactDir);
      totalSize += size;
      sizeStr = formatBytes(size);
    }

    log(`  ${colors.highlight(name)}${colors.dim(`@${artifact.version}`)}  ${colors.dim(sizeStr)}`);

    const manifestPath = `${artifactDir}/grekt.yaml`;
    if (fs.exists(manifestPath)) {
      const rawManifest = parse(fs.readFile(manifestPath));
      const manifestResult = ArtifactManifestSchema.safeParse(rawManifest);

      if (manifestResult.success && manifestResult.data.components) {
        for (const category of CATEGORIES) {
          const components = manifestResult.data.components[category];
          if (components && components.length > 0) {
            const names = components.map(c => c.name);
            log(`    ${colors.dim(`${category}:`)} ${names.join(", ")}`);
          }
        }
      }
    }

    newline();
  }

  // Show total context size
  log(colors.dim("─".repeat(40)));
  log(`  Total: ${formatBytes(totalSize)} (~${estimateTokens(totalSize).toLocaleString()} tokens)`);
}

async function listRemote(scope: string, options: { json?: boolean }): Promise<void> {
  // Ensure scope starts with @
  const normalizedScope = scope.startsWith("@") ? scope : `@${scope}`;

  const projectRoot = process.cwd();
  const localConfig = getLocalConfig(projectRoot);
  const registry = resolveRegistry(normalizedScope, localConfig, projectRoot);

  let browser;
  try {
    browser = createRegistryBrowser(registry, http);
  } catch (err) {
    error(err instanceof Error ? err.message : "Failed to create registry browser");
    return;
  }

  const spin = spinner(`Browsing artifacts in ${normalizedScope}...`);
  spin.start();

  const result = await browser.browse();
  spin.stop();

  if (!result.success) {
    error(result.error ?? "Failed to browse registry");
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(result.artifacts, null, 2));
    return;
  }

  if (result.artifacts.length === 0) {
    info(`No artifacts found in ${normalizedScope}`);
    return;
  }

  log(colors.bold(`Artifacts in ${normalizedScope}:`));
  newline();

  printArtifactTable(result.artifacts);

  newline();
  log(colors.dim(`${result.artifacts.length} artifact${result.artifacts.length === 1 ? "" : "s"} found`));

  if (result.truncated) {
    newline();
    warning("Results may be incomplete — the repository tree was truncated due to size.");
  }
}

function printArtifactTable(artifacts: BrowsedArtifact[]): void {
  // Calculate column widths for alignment
  const nameWidth = Math.max(...artifacts.map((a) => a.name.length));
  const versionWidth = Math.max(...artifacts.map((a) => a.version.length));

  for (const artifact of artifacts) {
    const name = colors.highlight(artifact.name.padEnd(nameWidth));
    const version = colors.dim(artifact.version.padEnd(versionWidth));
    const description = artifact.description ? `  ${artifact.description}` : "";

    log(`  ${name}  ${version}${description}`);
  }
}
