import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

export interface DownloadOptions {
  headers?: Record<string, string>;
  stripComponents?: number;
}

export interface TarballDownloadResult {
  success: boolean;
  error?: string;
}

/**
 * Download a tarball from URL and extract to target directory.
 * Handles temp file creation, extraction, and cleanup.
 *
 * @param url - URL to download tarball from
 * @param targetDir - Directory to extract contents to
 * @param options - Optional headers and extraction options
 */
export async function downloadAndExtractTarball(
  url: string,
  targetDir: string,
  options: DownloadOptions = {}
): Promise<TarballDownloadResult> {
  const { headers = {}, stripComponents = 1 } = options;

  // Ensure User-Agent is always set
  const finalHeaders: Record<string, string> = {
    "User-Agent": "grekt-cli",
    ...headers,
  };

  const tempTarball = join(tmpdir(), `grekt-${Date.now()}.tar.gz`);

  try {
    const response = await fetch(url, {
      headers: finalHeaders,
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const buffer = await response.arrayBuffer();
    writeFileSync(tempTarball, Buffer.from(buffer));

    // Ensure target directory exists
    mkdirSync(targetDir, { recursive: true });

    // Extract tarball
    const stripArg = stripComponents > 0 ? `--strip-components=${stripComponents}` : "";
    execSync(`tar -xzf ${tempTarball} -C ${targetDir} ${stripArg}`, {
      stdio: "pipe",
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    // Always clean up temp file
    if (existsSync(tempTarball)) {
      rmSync(tempTarball, { force: true });
    }
  }
}

/**
 * Build GitHub API tarball URL for a repository.
 */
export function buildGitHubTarballUrl(owner: string, repo: string, ref: string = "HEAD"): string {
  return `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;
}

/**
 * Build GitLab API archive URL for a project.
 */
export function buildGitLabArchiveUrl(
  host: string,
  projectPath: string,
  ref: string = "main"
): string {
  const encodedProject = encodeURIComponent(projectPath);
  return `https://${host}/api/v4/projects/${encodedProject}/repository/archive.tar.gz?sha=${ref}`;
}

/**
 * Get headers for GitHub API requests.
 */
export function getGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "grekt-cli",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Get headers for GitLab API requests.
 */
export function getGitLabHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "grekt-cli",
  };

  if (token) {
    headers["PRIVATE-TOKEN"] = token;
  }

  return headers;
}
