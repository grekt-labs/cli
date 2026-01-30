import { existsSync, unlinkSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import type { ArtifactInfo } from "#/context";
import type { ComponentSelection } from "#/artifact/selector/selector";
import { CATEGORIES } from "@grekt-labs/cli-engine";

/**
 * Remove unselected component files from artifact directory.
 * This is used when a user chooses to install only specific components.
 */
export function removeUnselectedFiles(
  artifactDir: string,
  artifactInfo: ArtifactInfo,
  selection: ComponentSelection
): void {
  for (const category of CATEGORIES) {
    for (const file of artifactInfo[category]) {
      if (!selection[category].includes(file.path)) {
        const filePath = join(artifactDir, file.path);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      }
    }
  }

  // Clean up empty directories
  cleanEmptyDirs(artifactDir);
}

/**
 * Recursively remove empty directories within a directory.
 * Failures are silently ignored since empty directory cleanup is best-effort.
 */
export function cleanEmptyDirs(dir: string): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subdir = join(dir, entry.name);
        cleanEmptyDirs(subdir);

        try {
          const remaining = readdirSync(subdir);
          if (remaining.length === 0) {
            rmSync(subdir, { recursive: true });
          }
        } catch {
          // Directory may have been removed or is inaccessible, skip it
        }
      }
    }
  } catch {
    // Directory may not exist or is inaccessible, skip it
  }
}
