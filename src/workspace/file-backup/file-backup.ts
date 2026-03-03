import { join, basename } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { fs } from "#/context";

/**
 * Maps original file paths to their backup locations in /tmp.
 * Only contains entries for files that existed at backup time.
 */
export type FileBackupManifest = Map<string, string>;

/**
 * Backup existing files to /tmp before overwriting.
 * Only files that actually exist are backed up.
 * Backup files are named with a UUID to avoid collisions.
 */
export function backupFiles(paths: string[]): FileBackupManifest {
  const manifest: FileBackupManifest = new Map();

  for (const filePath of paths) {
    if (!fs.exists(filePath)) continue;

    const fileId = randomUUID().slice(0, 8);
    const backupName = `grekt-bkp-${fileId}-${basename(filePath)}`;
    const backupPath = join(tmpdir(), backupName);

    fs.copyFile(filePath, backupPath);
    manifest.set(filePath, backupPath);
  }

  return manifest;
}

/**
 * Restore files from backup, then remove the backup copies.
 * Paths not in the manifest are silently skipped.
 */
export function restoreFiles(manifest: FileBackupManifest): void {
  for (const [originalPath, backupPath] of manifest) {
    fs.copyFile(backupPath, originalPath);
    fs.unlink(backupPath);
  }
}
