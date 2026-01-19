/**
 * GitHub source fetcher for packages
 * Supports: github:user/repo/path or full URLs
 */

import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";

export interface GitHubSource {
  owner: string;
  repo: string;
  path: string;
  branch: string;
}

export function isGitHubSource(input: string): boolean {
  return (
    input.startsWith("github:") ||
    input.includes("github.com") ||
    input.includes("raw.githubusercontent.com")
  );
}

export function parseGitHubSource(input: string): GitHubSource | null {
  // Shorthand: github:user/repo/path
  if (input.startsWith("github:")) {
    const parts = input.slice(7).split("/");
    if (parts.length < 3) return null;
    const owner = parts[0]!;
    const repo = parts[1]!;
    const path = parts.slice(2).join("/");
    return { owner, repo, path, branch: "main" };
  }

  // GitHub blob/tree URL: https://github.com/user/repo/blob/branch/path
  const match = input.match(
    /github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|tree)\/([^\/]+)\/(.+)/
  );
  if (match && match[1] && match[2] && match[3] && match[4]) {
    return {
      owner: match[1],
      repo: match[2],
      branch: match[3],
      path: match[4],
    };
  }

  return null;
}

// Legacy function for backward compat
export function toRawUrl(input: string): string | null {
  const source = parseGitHubSource(input);
  if (!source) return null;
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch}/${source.path}`;
}

export async function fetchRawFile(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

interface GitHubContentsItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

export async function downloadPackage(
  source: GitHubSource,
  targetDir: string
): Promise<boolean> {
  // Use GitHub API to list contents
  const apiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${source.path}?ref=${source.branch}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "grekt-cli",
      },
    });

    if (!response.ok) {
      return false;
    }

    const contents = (await response.json()) as GitHubContentsItem[];

    // Download all files recursively
    await downloadContents(contents, source, targetDir, "");

    return true;
  } catch {
    return false;
  }
}

async function downloadContents(
  contents: GitHubContentsItem[],
  source: GitHubSource,
  targetDir: string,
  subPath: string
): Promise<void> {
  for (const item of contents) {
    const localPath = join(targetDir, subPath, item.name);

    if (item.type === "file" && item.download_url) {
      // Download file
      const content = await fetchRawFile(item.download_url);
      if (content !== null) {
        mkdirSync(dirname(localPath), { recursive: true });
        writeFileSync(localPath, content, "utf-8");
      }
    } else if (item.type === "dir") {
      // Recursively fetch directory contents
      const dirApiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${item.path}?ref=${source.branch}`;
      const response = await fetch(dirApiUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "grekt-cli",
        },
      });

      if (response.ok) {
        const dirContents = (await response.json()) as GitHubContentsItem[];
        await downloadContents(
          dirContents,
          source,
          targetDir,
          join(subPath, item.name)
        );
      }
    }
  }
}
