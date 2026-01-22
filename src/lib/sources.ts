import { mkdirSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { getTokenCredentials } from "#/lib/credentials";
import type { DownloadResult } from "#/lib/registry";

export type SourceType = "registry" | "github" | "gitlab";

export interface ParsedSource {
  type: SourceType;
  /** For registry: artifact ID. For git: owner/repo */
  identifier: string;
  /** Git ref (tag, branch, commit). Defaults to HEAD/main */
  ref?: string;
  /** For self-hosted GitLab: the host */
  host?: string;
  /** Original source string */
  raw: string;
}

/**
 * Parse artifact source string into structured format
 *
 * Supported formats:
 * - `@author/name` or `name` → registry
 * - `github:owner/repo` → GitHub
 * - `github:owner/repo#v1.0.0` → GitHub with tag
 * - `gitlab:owner/repo` → GitLab.com
 * - `gitlab:host.com/owner/repo` → Self-hosted GitLab
 * - `gitlab:host.com/owner/repo#main` → Self-hosted with ref
 */
export function parseSource(source: string): ParsedSource {
  // GitHub: github:owner/repo or github:owner/repo#ref
  if (source.startsWith("github:")) {
    const rest = source.slice(7); // Remove "github:"
    const hashIndex = rest.indexOf("#");
    const repoPath = hashIndex === -1 ? rest : rest.slice(0, hashIndex);
    const ref = hashIndex === -1 ? undefined : rest.slice(hashIndex + 1);
    return {
      type: "github",
      identifier: repoPath,
      ref: ref || undefined,
      raw: source,
    };
  }

  // GitLab: gitlab:owner/repo or gitlab:host/owner/repo
  if (source.startsWith("gitlab:")) {
    const rest = source.slice(7); // Remove "gitlab:"
    const hashIndex = rest.indexOf("#");
    const pathPart = hashIndex === -1 ? rest : rest.slice(0, hashIndex);
    const ref = hashIndex === -1 ? undefined : rest.slice(hashIndex + 1);
    const parts = pathPart.split("/");

    // If 3+ parts and first part looks like a host (has dot), it's self-hosted
    if (parts.length >= 3 && parts[0]!.includes(".")) {
      const host = parts[0]!;
      const identifier = parts.slice(1).join("/");
      return {
        type: "gitlab",
        identifier,
        ref: ref || undefined,
        host,
        raw: source,
      };
    }

    // Otherwise it's gitlab.com
    return {
      type: "gitlab",
      identifier: pathPart,
      ref: ref || undefined,
      host: "gitlab.com",
      raw: source,
    };
  }

  // Default: registry
  return {
    type: "registry",
    identifier: source,
    raw: source,
  };
}

/**
 * Get auth token for a source
 */
export function getSourceToken(source: ParsedSource): string | undefined {
  // Check environment variables first
  if (source.type === "github") {
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (envToken) return envToken;
  }

  if (source.type === "gitlab") {
    // For self-hosted, check host-specific env var first
    if (source.host && source.host !== "gitlab.com") {
      const hostEnvKey = `GITLAB_TOKEN_${source.host.replace(/\./g, "_").toUpperCase()}`;
      const hostToken = process.env[hostEnvKey];
      if (hostToken) return hostToken;
    }
    const envToken = process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
    if (envToken) return envToken;
  }

  // Check credentials file
  if (source.type === "github") {
    const token = getTokenCredentials("github");
    if (token) return token;
  }
  if (source.type === "gitlab") {
    const key = source.host || "gitlab.com";
    const token = getTokenCredentials(key);
    if (token) return token;
  }

  return undefined;
}

/**
 * Download artifact from GitHub
 */
export async function downloadFromGitHub(
  source: ParsedSource,
  targetDir: string
): Promise<DownloadResult> {
  const token = getSourceToken(source);
  const ref = source.ref || "HEAD";

  // GitHub tarball URL
  const tarballUrl = `https://api.github.com/repos/${source.identifier}/tarball/${ref}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "grekt-cli",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(tarballUrl, {
      headers,
      redirect: "follow",
    });

    if (!response.ok) {
      return { success: false };
    }

    const buffer = await response.arrayBuffer();
    const tempTarball = `/tmp/grekt-github-${Date.now()}.tar.gz`;
    writeFileSync(tempTarball, Buffer.from(buffer));

    mkdirSync(targetDir, { recursive: true });

    // Extract with strip-components to remove the GitHub-generated root folder
    execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
      stdio: "pipe",
    });
    execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

    return { success: true, version: ref };
  } catch {
    return { success: false };
  }
}

/**
 * Download artifact from GitLab
 */
export async function downloadFromGitLab(
  source: ParsedSource,
  targetDir: string
): Promise<DownloadResult> {
  const token = getSourceToken(source);
  const host = source.host || "gitlab.com";
  const ref = source.ref || "main";

  // URL-encode the project path for GitLab API
  const encodedProject = encodeURIComponent(source.identifier);

  // GitLab archive URL
  const archiveUrl = `https://${host}/api/v4/projects/${encodedProject}/repository/archive.tar.gz?sha=${ref}`;

  const headers: Record<string, string> = {
    "User-Agent": "grekt-cli",
  };

  if (token) {
    headers["PRIVATE-TOKEN"] = token;
  }

  try {
    const response = await fetch(archiveUrl, {
      headers,
      redirect: "follow",
    });

    if (!response.ok) {
      return { success: false };
    }

    const buffer = await response.arrayBuffer();
    const tempTarball = `/tmp/grekt-gitlab-${Date.now()}.tar.gz`;
    writeFileSync(tempTarball, Buffer.from(buffer));

    mkdirSync(targetDir, { recursive: true });

    // Extract with strip-components to remove the GitLab-generated root folder
    execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
      stdio: "pipe",
    });
    execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

    return { success: true, version: ref };
  } catch {
    return { success: false };
  }
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
      return downloadFromGitHub(source, targetDir);
    case "gitlab":
      return downloadFromGitLab(source, targetDir);
    case "registry":
      // Import dynamically to avoid circular dependency
      const { downloadFromRegistry } = await import("#/lib/registry");
      return downloadFromRegistry(source.identifier, targetDir, projectRoot);
    default:
      return { success: false };
  }
}

/**
 * Get a display name for a source
 */
export function getSourceDisplayName(source: ParsedSource): string {
  switch (source.type) {
    case "github":
      return `github:${source.identifier}${source.ref ? `#${source.ref}` : ""}`;
    case "gitlab":
      const host = source.host === "gitlab.com" ? "" : `${source.host}/`;
      return `gitlab:${host}${source.identifier}${source.ref ? `#${source.ref}` : ""}`;
    case "registry":
      return source.identifier;
    default:
      return source.raw;
  }
}
