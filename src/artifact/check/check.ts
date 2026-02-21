import { verifyIntegrity, getDirectorySize, fs, getLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { compareHashes, hashContent, type Lockfile, type IntegrityResult } from "@grekt-labs/cli-engine";
import { readlinkSync, lstatSync } from "fs";

type CheckStatus = "ok" | "drift" | "missing";

export interface CheckResult {
  artifactId: string;
  status: CheckStatus;
  issues: string[];
}

export interface CheckSummary {
  results: CheckResult[];
  totalSize: number;
  okCount: number;
  driftCount: number;
  missingCount: number;
  healthy: boolean;
}

export interface SyncCheckResult {
  artifactId: string;
  pluginId: string;
  status: CheckStatus;
  issues: string[];
}

export interface SyncCheckSummary {
  results: SyncCheckResult[];
  okCount: number;
  driftCount: number;
  missingCount: number;
  healthy: boolean;
}

/** Convert an IntegrityResult into status + human-readable issues */
function interpretIntegrity(integrity: IntegrityResult): { status: CheckStatus; issues: string[] } {
  if (integrity.valid) return { status: "ok", issues: [] };

  const issues: string[] = [];
  const hasMissing = integrity.missingFiles.length > 0;

  for (const file of integrity.missingFiles) {
    issues.push(`Missing: ${file}`);
  }
  for (const mod of integrity.modifiedFiles) {
    issues.push(`Modified: ${mod.path}`);
  }

  return { status: hasMissing ? "missing" : "drift", issues };
}

/** Count results by status and derive overall health */
function summarizeCounts<T extends { status: CheckStatus }>(results: T[]) {
  const okCount = results.filter((r) => r.status === "ok").length;
  const driftCount = results.filter((r) => r.status === "drift").length;
  const missingCount = results.filter((r) => r.status === "missing").length;
  return { okCount, driftCount, missingCount, healthy: driftCount === 0 && missingCount === 0 };
}

/**
 * Build actual hashes for synced files, handling both regular files and symlinks.
 * Returns a hash map compatible with compareHashes.
 */
function resolveActualSyncHashes(
  projectRoot: string,
  expectedHashes: Record<string, string>,
): Record<string, string> {
  const actualHashes: Record<string, string> = {};

  for (const [targetPath, expectedHash] of Object.entries(expectedHashes)) {
    const fullPath = `${projectRoot}/${targetPath}`;

    if (!fs.exists(fullPath)) continue;

    if (expectedHash.startsWith("link:")) {
      try {
        const stat = lstatSync(fullPath);
        if (!stat.isSymbolicLink()) {
          actualHashes[targetPath] = "not-a-symlink";
          continue;
        }
        const actualTarget = readlinkSync(fullPath, "utf-8");
        actualHashes[targetPath] = `link:${actualTarget}`;
      } catch {
        actualHashes[targetPath] = "unreadable-symlink";
      }
    } else {
      const content = fs.readFile(fullPath);
      actualHashes[targetPath] = hashContent(content);
    }
  }

  return actualHashes;
}

/**
 * Check synced files against lockfile hashes.
 * Detects drift in files copied/symlinked to tool-specific targets.
 */
export function runSyncCheck(projectRoot: string, lockfile?: Lockfile): SyncCheckSummary {
  lockfile ??= getLockfile(projectRoot);

  const results: SyncCheckResult[] = [];

  for (const [artifactId, entry] of Object.entries(lockfile.artifacts)) {
    if (!entry.synced) continue;

    for (const [pluginId, expectedHashes] of Object.entries(entry.synced)) {
      const actualHashes = resolveActualSyncHashes(projectRoot, expectedHashes);
      const integrity = compareHashes(expectedHashes, actualHashes);
      const { status, issues } = interpretIntegrity(integrity);

      results.push({ artifactId, pluginId, status, issues });
    }
  }

  return { results, ...summarizeCounts(results) };
}

export function runCheck(projectRoot: string, lockfile?: Lockfile): CheckSummary {
  lockfile ??= getLockfile(projectRoot);
  const artifactIds = Object.keys(lockfile.artifacts);

  const results: CheckResult[] = [];
  let totalSize = 0;

  for (const artifactId of artifactIds) {
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
    const lockEntry = lockfile.artifacts[artifactId];

    if (!fs.exists(artifactDir)) {
      results.push({ artifactId, status: "missing", issues: ["Directory not found"] });
      continue;
    }

    if (lockEntry?.files && Object.keys(lockEntry.files).length > 0) {
      const integrity = verifyIntegrity(artifactDir, lockEntry.files);
      const { status, issues } = interpretIntegrity(integrity);
      results.push({ artifactId, status, issues });
    } else {
      results.push({ artifactId, status: "ok", issues: [] });
    }

    totalSize += getDirectorySize(artifactDir);
  }

  return { results, totalSize, ...summarizeCounts(results) };
}

