/**
 * CLI wrappers for cli-engine functions.
 * These inject the real FileSystem so callers don't have to.
 */
import { join } from "path";
import { fs } from "./filesystem";
import {
  getLockfile as _getLockfile,
  saveLockfile as _saveLockfile,
  createEmptyLockfile,
  lockfileExists as _lockfileExists,
  scanArtifact as _scanArtifact,
  hashDirectory as _hashDirectory,
  verifyIntegrity as _verifyIntegrity,
  getDirectorySize as _getDirectorySize,
  type Lockfile,
} from "@grekt-labs/cli-engine";
import { LOCKFILE } from "#/constants";

// Lockfile operations
export function getLockfile(projectRoot: string = process.cwd()): Lockfile {
  const lockfilePath = join(projectRoot, LOCKFILE);
  const result = _getLockfile(fs, lockfilePath);
  if (!result.success) {
    const details = result.error.details?.join("\n  ") ?? "";
    throw new Error(`${result.error.message}${details ? `\n  ${details}` : ""}`);
  }
  return result.data;
}

export function saveLockfile(data: Lockfile, projectRoot: string = process.cwd()): void {
  const lockfilePath = join(projectRoot, LOCKFILE);
  _saveLockfile(fs, lockfilePath, data);
}

export function lockfileExists(projectRoot: string = process.cwd()): boolean {
  const lockfilePath = join(projectRoot, LOCKFILE);
  return _lockfileExists(fs, lockfilePath);
}

export { createEmptyLockfile };

// Scanner operations
export function scanArtifact(artifactDir: string) {
  return _scanArtifact(fs, artifactDir);
}

export type { ArtifactInfo } from "@grekt-labs/cli-engine";

// Integrity operations
export function hashDirectory(dir: string) {
  return _hashDirectory(fs, dir);
}

export function verifyIntegrity(artifactDir: string, expectedFiles: Record<string, string>) {
  return _verifyIntegrity(fs, artifactDir, expectedFiles);
}

export function getDirectorySize(dir: string) {
  return _getDirectorySize(fs, dir);
}
