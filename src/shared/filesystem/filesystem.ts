import { dirname, join } from "path";
import { fs } from "#/context";

/**
 * Ensure the parent directory of a filepath exists.
 */
export function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!fs.exists(dir)) {
    fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Remove a directory if it is empty.
 */
export function cleanEmptyDir(dir: string): void {
  if (fs.exists(dir)) {
    const files = fs.readdir(dir);
    if (files.length === 0) {
      fs.rmdir(dir, { recursive: true });
    }
  }
}

/**
 * Recursively remove empty directories within a directory.
 * Failures are silently ignored since empty directory cleanup is best-effort.
 */
export function cleanEmptyDirs(dir: string): void {
  try {
    const entries = fs.readdir(dir);

    for (const entry of entries) {
      const subdir = join(dir, entry);
      try {
        const stat = fs.stat(subdir);
        if (stat.isDirectory) {
          cleanEmptyDirs(subdir);

          try {
            const remaining = fs.readdir(subdir);
            if (remaining.length === 0) {
              fs.rmdir(subdir, { recursive: true });
            }
          } catch {
            // Directory may have been removed or is inaccessible
          }
        }
      } catch {
        // Entry may have been removed or is inaccessible
      }
    }
  } catch {
    // Directory may not exist or is inaccessible
  }
}
