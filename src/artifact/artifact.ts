// Artifact domain barrel export
export * from "./check/check";
export * from "./selector/selector";
export * from "./component-manager/component-manager";

// Re-export from cli-engine for backwards compatibility
export {
  parseFrontmatter,
  type ParsedArtifact,
  getSafeFilename,
  toSafeName,
  parseName,
  type ArtifactInfo,
  calculateIntegrity,
  type IntegrityResult,
  formatBytes,
  estimateTokens,
  createEmptyLockfile,
  type Lockfile,
  type LockfileEntry,
} from "@grekt-labs/cli-engine";

// Re-export from context (functions with FileSystem injected)
export {
  getLockfile,
  saveLockfile,
  lockfileExists,
  scanArtifact,
  hashDirectory,
  verifyIntegrity,
  getDirectorySize,
} from "#/context";
