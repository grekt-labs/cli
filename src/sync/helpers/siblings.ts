import { basename, join } from "path";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { fs } from "#/context";

/**
 * Recursively copy a directory and all its contents.
 */
export function copyDirectoryRecursive(source: string, target: string): void {
  fs.mkdir(target, { recursive: true });

  const entries = fs.readdir(source);
  for (const entry of entries) {
    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);
    const stat = fs.stat(sourcePath);

    if (stat.isDirectory) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (stat.isFile) {
      fs.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Copy sibling files and directories next to a synced SKILL.md.
 * Only applies when the skill source is a directory (e.g., skills/create-module/SKILL.md).
 * For flat skill files (e.g., skills/create-module.md), sourceDir is the parent category
 * directory shared by all skills, so copying siblings would be incorrect.
 */
export function copySiblingFiles(sourceDir: string, targetDir: string, sourceFilePath: string): void {
  if (!fs.exists(sourceDir)) return;

  // Only copy siblings if the source is a SKILL.md inside a dedicated directory.
  // For flat .md files, sourceDir is the shared category directory — skip.
  const sourceFileName = basename(sourceFilePath);
  if (sourceFileName !== "SKILL.md") return;

  const entries = fs.readdir(sourceDir);

  for (const entry of entries) {
    if (entry === "SKILL.md") continue;
    if (entry === "grekt.yaml" || entry === ".grekt") continue;

    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stat = fs.stat(sourcePath);

    if (stat.isDirectory) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (stat.isFile) {
      ensureDir(targetPath);
      fs.copyFile(sourcePath, targetPath);
    }
  }
}
