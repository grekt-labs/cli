import { join } from "path";
import { fs } from "#/context";
import type { ArtifactInfo } from "#/context";
import type { ComponentSelection } from "#/artifact/selector/selector";
import { CATEGORIES } from "@grekt/engine";
import { cleanEmptyDirs } from "#/shared/filesystem/filesystem";

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
        if (fs.exists(filePath)) {
          fs.unlink(filePath);
        }
      }
    }
  }

  // Clean up empty directories
  cleanEmptyDirs(artifactDir);
}

