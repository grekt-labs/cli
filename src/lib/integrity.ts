import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

function hashFile(filepath: string): string {
  const content = readFileSync(filepath);
  const hash = createHash("sha256").update(content).digest("hex");
  return `sha256:${hash.slice(0, 16)}`; // First 16 hex chars for readability
}

/**
 * Hash all files in a directory recursively
 * Returns a map of relative paths to their hashes
 */
export function hashDirectory(dir: string): Record<string, string> {
  const hashes: Record<string, string> = {};

  function walkDir(currentDir: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const relativePath = relative(dir, fullPath);
        hashes[relativePath] = hashFile(fullPath);
      }
    }
  }

  walkDir(dir);
  return hashes;
}

/**
 * Calculate integrity hash for entire artifact (hash of sorted file hashes)
 */
export function calculateIntegrity(fileHashes: Record<string, string>): string {
  const sortedKeys = Object.keys(fileHashes).sort();
  const combined = sortedKeys.map((k) => `${k}:${fileHashes[k]}`).join("\n");
  const hash = createHash("sha256").update(combined).digest("hex");
  return `sha256:${hash.slice(0, 16)}`;
}

export interface IntegrityResult {
  valid: boolean;
  missingFiles: string[];
  modifiedFiles: { path: string; expected: string; actual: string }[];
  extraFiles: string[];
}

/**
 * Verify integrity of an artifact against lockfile hashes
 */
export function verifyIntegrity(
  artifactDir: string,
  expectedFiles: Record<string, string>
): IntegrityResult {
  const result: IntegrityResult = {
    valid: true,
    missingFiles: [],
    modifiedFiles: [],
    extraFiles: [],
  };

  const actualHashes = hashDirectory(artifactDir);
  const expectedPaths = new Set(Object.keys(expectedFiles));
  const actualPaths = new Set(Object.keys(actualHashes));

  // Check for missing files
  for (const path of expectedPaths) {
    if (!actualPaths.has(path)) {
      result.missingFiles.push(path);
      result.valid = false;
    }
  }

  // Check for modified files
  for (const path of expectedPaths) {
    const actualHash = actualHashes[path];
    const expectedHash = expectedFiles[path];
    if (actualHash && expectedHash && actualHash !== expectedHash) {
      result.modifiedFiles.push({
        path,
        expected: expectedHash,
        actual: actualHash,
      });
      result.valid = false;
    }
  }

  // Check for extra files (not necessarily invalid, but noteworthy)
  for (const path of actualPaths) {
    if (!expectedPaths.has(path)) {
      result.extraFiles.push(path);
    }
  }

  return result;
}

/**
 * Get total size of all files in a directory (in bytes)
 */
export function getDirectorySize(dir: string): number {
  let totalSize = 0;

  function walkDir(currentDir: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        totalSize += statSync(fullPath).size;
      }
    }
  }

  walkDir(dir);
  return totalSize;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Estimate tokens from bytes (rough approximation)
 */
export function estimateTokens(bytes: number): number {
  // ~4 chars per token, ~1 byte per char for ASCII
  return Math.round(bytes / 4);
}
