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
import { error, info } from "#/shared/ui/ui";

const WORKSPACE_CONFIG_FILE = "grekt-workspace.yaml";
const ARTIFACT_MANIFEST_FILE = "grekt.yaml";

export interface WorkspaceData {
  root: string;
  artifacts: WorkspaceArtifact[];
}

/**
 * Load workspace configuration and discover artifacts.
 */
export async function loadWorkspace(cwd: string): Promise<WorkspaceData | null> {
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
 * Generate temporary pnpm-workspace.yaml for external tool workspace discovery.
 * Tools like changesets use @manypkg/find-root which detects pnpm workspaces
 * without requiring a lock file, making this the most portable approach.
 */
export function generateWorkspaceFile(root: string, artifacts: WorkspaceArtifact[]): void {
  const workspacePath = join(root, "pnpm-workspace.yaml");
  const rootPackageJsonPath = join(root, "package.json");
  const relativePaths = artifacts.map((artifact) => artifact.relativePath);

  fs.writeFile(workspacePath, stringifyYaml({ packages: relativePaths }));
  fs.writeFile(rootPackageJsonPath, JSON.stringify({ name: "workspace-root", private: true }, null, 2) + "\n");
}

/**
 * Remove temporary pnpm-workspace.yaml and root package.json.
 */
export function cleanWorkspaceFile(root: string): void {
  const workspacePath = join(root, "pnpm-workspace.yaml");
  const rootPackageJsonPath = join(root, "package.json");

  if (fs.exists(workspacePath)) {
    fs.unlink(workspacePath);
  }
  if (fs.exists(rootPackageJsonPath)) {
    fs.unlink(rootPackageJsonPath);
  }
}

/**
 * Generate temporary package.json files for changeset compatibility.
 */
export function generatePackageJsonFiles(artifacts: WorkspaceArtifact[]): void {
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
export function syncVersionsToManifest(artifacts: WorkspaceArtifact[]): number {
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
export function cleanPackageJsonFiles(artifacts: WorkspaceArtifact[]): void {
  for (const artifact of artifacts) {
    const packageJsonPath = join(artifact.path, "package.json");
    if (fs.exists(packageJsonPath)) {
      fs.unlink(packageJsonPath);
    }
  }
}
