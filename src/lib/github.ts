/**
 * Simple GitHub raw file fetcher
 * Supports: github:user/repo/path or raw URLs
 */

export function isGitHubSource(input: string): boolean {
  return input.startsWith("github:") || input.includes("github.com") || input.includes("raw.githubusercontent.com");
}

export function toRawUrl(input: string): string | null {
  // Already a raw URL
  if (input.startsWith("https://raw.githubusercontent.com/")) {
    return input;
  }

  // Shorthand: github:user/repo/path/file.md
  if (input.startsWith("github:")) {
    const parts = input.slice(7).split("/");
    if (parts.length < 3) return null;
    const [owner, repo, ...pathParts] = parts;
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${pathParts.join("/")}`;
  }

  // GitHub blob URL: https://github.com/user/repo/blob/branch/path
  const blobMatch = input.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/);
  if (blobMatch) {
    const [, owner, repo, branch, path] = blobMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  return null;
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
