import { resolve } from "path";
import { homedir } from "os";
import { getLocalConfig, getToken } from "#/config/project/project";
import {
  type DownloadResult,
  type ParsedSource,
  parseArtifactId,
  parseSource,
  buildGitHubTarballUrl,
  buildGitLabArchiveUrl,
  getGitHubHeaders,
  getGitLabHeaders,
  downloadAndExtractTarball,
} from "@grekt-labs/cli-engine";
import { resolveRegistry, createRegistryClient } from "#/registry/factory/factory";
import { copyDirectoryRecursive } from "#/sync/helpers/siblings";
import { fs, http, tarOps } from "#/context";

// Re-export parseSource and ParsedSource for backwards compatibility
export { parseSource };
export type { ParsedSource };

/**
 * Get token for a git source
 *
 * Priority:
 * 1. Config file (.grekt/config.yaml tokens section)
 * 2. Platform env vars (GITHUB_TOKEN, GITLAB_TOKEN) - for users who already have them set
 */
export function getSourceToken(source: ParsedSource, projectRoot: string): string | undefined {
  // Check project config first (.grekt/config.yaml tokens section)
  if (source.type === "github") {
    const token = getToken("github", projectRoot);
    if (token) return token;
  }
  if (source.type === "gitlab") {
    const key = source.host || "gitlab.com";
    const token = getToken(key, projectRoot);
    if (token) return token;
  }

  // Fall back to platform env vars (users might already have these set)
  if (source.type === "github") {
    return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  }

  if (source.type === "gitlab") {
    return process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
  }

  return undefined;
}

async function downloadFromGitHub(
  source: ParsedSource,
  targetDir: string,
  projectRoot: string
): Promise<DownloadResult> {
  const token = getSourceToken(source, projectRoot);
  const ref = source.ref || "HEAD";
  const [owner, repo] = source.identifier.split("/");

  const url = buildGitHubTarballUrl(owner!, repo!, ref);
  const headers = getGitHubHeaders(token);

  const result = await downloadAndExtractTarball(http, fs, tarOps, url, targetDir, { headers });

  if (result.success) {
    return { success: true, version: ref };
  }
  return { success: false, error: result.error || "Failed to download from GitHub" };
}

async function downloadFromGitLab(
  source: ParsedSource,
  targetDir: string,
  projectRoot: string
): Promise<DownloadResult> {
  const token = getSourceToken(source, projectRoot);
  const host = source.host || "gitlab.com";
  const ref = source.ref || "main";

  const url = buildGitLabArchiveUrl(host, source.identifier, ref);
  const headers = getGitLabHeaders(token);

  const result = await downloadAndExtractTarball(http, fs, tarOps, url, targetDir, { headers });

  if (result.success) {
    return { success: true, version: ref };
  }
  return { success: false, error: result.error || "Failed to download from GitLab" };
}

/**
 * Copy a local directory as an artifact source.
 * Resolves relative paths and ~ expansion.
 */
function downloadFromLocal(source: ParsedSource, targetDir: string): DownloadResult {
  const expandedPath = source.identifier.startsWith("~/")
    ? source.identifier.replace("~", homedir())
    : source.identifier;
  const sourcePath = resolve(expandedPath);

  if (!fs.exists(sourcePath)) {
    return { success: false, error: `Local path not found: ${sourcePath}` };
  }

  const stat = fs.stat(sourcePath);
  if (!stat.isDirectory) {
    return { success: false, error: `Local path is not a directory: ${sourcePath}` };
  }

  copyDirectoryRecursive(sourcePath, targetDir);

  return { success: true, resolved: sourcePath };
}

/**
 * Download artifact from any supported source
 */
export async function downloadFromSource(
  source: ParsedSource,
  targetDir: string,
  projectRoot: string
): Promise<DownloadResult> {
  switch (source.type) {
    case "github":
      return downloadFromGitHub(source, targetDir, projectRoot);
    case "gitlab":
      return downloadFromGitLab(source, targetDir, projectRoot);
    case "registry":
      return downloadFromRegistrySource(source.identifier, targetDir, projectRoot);
    case "local":
      return downloadFromLocal(source, targetDir);
    default:
      return { success: false };
  }
}

/**
 * Download artifact from registry using the registry abstraction layer
 */
async function downloadFromRegistrySource(
  artifactSource: string,
  targetDir: string,
  projectRoot: string
): Promise<DownloadResult> {
  try {
    const { scope, artifactId, version } = parseArtifactId(artifactSource);
    const localConfig = getLocalConfig(projectRoot);
    const registry = resolveRegistry(scope, localConfig, projectRoot);
    const client = createRegistryClient(registry);

    return await client.download(artifactId, { version, targetDir });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
