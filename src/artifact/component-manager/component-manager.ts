import { existsSync, unlinkSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import type { ArtifactInfo } from "#/artifact/scanner/scanner";
import type { ComponentSelection } from "#/artifact/selector/selector";

/**
 * Remove unselected component files from artifact directory.
 * This is used when a user chooses to install only specific components.
 */
export function removeUnselectedFiles(
  artifactDir: string,
  artifactInfo: ArtifactInfo,
  selection: ComponentSelection
): void {
  // Remove unselected agent
  if (artifactInfo.agent && !selection.agent) {
    const agentPath = join(artifactDir, artifactInfo.agent.path);
    if (existsSync(agentPath)) {
      unlinkSync(agentPath);
    }
  }

  // Remove unselected skills
  for (const skill of artifactInfo.skills) {
    if (!selection.skills.includes(skill.path)) {
      const skillPath = join(artifactDir, skill.path);
      if (existsSync(skillPath)) {
        unlinkSync(skillPath);
      }
    }
  }

  // Remove unselected commands
  for (const cmd of artifactInfo.commands) {
    if (!selection.commands.includes(cmd.path)) {
      const cmdPath = join(artifactDir, cmd.path);
      if (existsSync(cmdPath)) {
        unlinkSync(cmdPath);
      }
    }
  }

  // Clean up empty directories
  cleanEmptyDirs(artifactDir);
}

/**
 * Recursively remove empty directories within a directory.
 */
export function cleanEmptyDirs(dir: string): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subdir = join(dir, entry.name);
      cleanEmptyDirs(subdir);

      // Check if directory is now empty
      const remaining = readdirSync(subdir);
      if (remaining.length === 0) {
        rmSync(subdir);
      }
    }
  }
}

/**
 * Remove a single directory if it's empty.
 */
export function removeIfEmpty(dir: string): boolean {
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    if (files.length === 0) {
      rmSync(dir, { recursive: true });
      return true;
    }
  }
  return false;
}
