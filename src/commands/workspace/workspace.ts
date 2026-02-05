import { Command } from "commander";
import { join } from "path";
import fg from "fast-glob";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseWorkspaceConfig,
  isWorkspaceRoot,
  discoverWorkspaceArtifacts,
  type WorkspaceArtifact,
} from "@grekt-labs/cli-engine";
import { fs } from "#/context";
import { success, error, info, log, colors } from "#/shared/ui/ui";

const WORKSPACE_CONFIG_FILE = "grekt-workspace.yaml";
const ARTIFACT_MANIFEST_FILE = "grekt.yaml";

interface WorkspaceData {
  root: string;
  artifacts: WorkspaceArtifact[];
}

/**
 * Load workspace configuration and discover artifacts.
 */
async function loadWorkspace(cwd: string): Promise<WorkspaceData | null> {
  if (!isWorkspaceRoot(fs, cwd)) {
    return null;
  }

  const configPath = join(cwd, WORKSPACE_CONFIG_FILE);
  const configContent = fs.readFile(configPath);
  const result = parseWorkspaceConfig(configContent, configPath);

  if (!result.success) {
    error(result.error.message);
    result.error.details?.forEach((detail) => info(`  ${detail}`));
    process.exit(1);
  }

  const config = result.data;
  const artifactPaths: string[] = [];

  for (const pattern of config.workspaces) {
    const matches = await fg(pattern, {
      cwd,
      onlyDirectories: true,
      absolute: true,
    });

    for (const fullPath of matches) {
      const manifestPath = join(fullPath, ARTIFACT_MANIFEST_FILE);
      if (fs.exists(manifestPath)) {
        artifactPaths.push(fullPath);
      }
    }
  }

  const discovered = discoverWorkspaceArtifacts(fs, cwd, artifactPaths);

  return {
    root: discovered.root,
    artifacts: discovered.artifacts,
  };
}

/**
 * Generate temporary package.json files for changeset compatibility.
 */
function generatePackageJsonFiles(artifacts: WorkspaceArtifact[]): void {
  for (const artifact of artifacts) {
    const packageJsonPath = join(artifact.path, "package.json");
    const packageJson = {
      name: artifact.manifest.name,
      version: artifact.manifest.version,
      private: true,
    };
    fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  }
}

/**
 * Sync versions from package.json back to grekt.yaml.
 */
function syncVersionsToManifest(artifacts: WorkspaceArtifact[]): number {
  let updated = 0;

  for (const artifact of artifacts) {
    const packageJsonPath = join(artifact.path, "package.json");
    const manifestPath = join(artifact.path, ARTIFACT_MANIFEST_FILE);

    if (!fs.exists(packageJsonPath)) continue;

    const packageJson = JSON.parse(fs.readFile(packageJsonPath));
    const newVersion = packageJson.version;

    if (newVersion && newVersion !== artifact.manifest.version) {
      const manifestContent = fs.readFile(manifestPath);
      const manifest = parseYaml(manifestContent);
      manifest.version = newVersion;
      fs.writeFile(manifestPath, stringifyYaml(manifest));
      updated++;
    }
  }

  return updated;
}

/**
 * Remove generated package.json files.
 */
function cleanPackageJsonFiles(artifacts: WorkspaceArtifact[]): void {
  for (const artifact of artifacts) {
    const packageJsonPath = join(artifact.path, "package.json");
    if (fs.exists(packageJsonPath)) {
      fs.unlink(packageJsonPath);
    }
  }
}

// List subcommand
const listSubcommand = new Command("list")
  .description("List all artifacts in the workspace")
  .action(async () => {
    const cwd = process.cwd();
    const workspace = await loadWorkspace(cwd);

    if (!workspace) {
      error(`No ${WORKSPACE_CONFIG_FILE} found in current directory`);
      process.exit(1);
    }

    if (workspace.artifacts.length === 0) {
      info("No artifacts found in workspace");
      return;
    }

    log("");
    info(`Found ${workspace.artifacts.length} artifact(s) in workspace:`);
    log("");

    for (const artifact of workspace.artifacts) {
      log(`  ${colors.bold(artifact.manifest.name)} ${colors.dim(`v${artifact.manifest.version}`)}`);
      log(`    ${colors.dim(artifact.relativePath)}`);
    }

    log("");
  });

// Main workspace command
export const workspaceCommand = new Command("workspace")
  .description("Manage monorepo workspaces")
  .addCommand(listSubcommand);

// Export utilities for use by other commands
export { loadWorkspace, generatePackageJsonFiles, syncVersionsToManifest, cleanPackageJsonFiles };
export type { WorkspaceData };
