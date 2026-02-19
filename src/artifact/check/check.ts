import { verifyIntegrity, getDirectorySize, fs, getLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import type { Lockfile } from "@grekt-labs/cli-engine";

export interface CheckResult {
  artifactId: string;
  status: "ok" | "drift" | "missing";
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

/**
 * Run integrity check on all installed artifacts.
 * Accepts an optional lockfile to avoid re-reading from disk.
 */
export function runCheck(projectRoot: string, lockfile?: Lockfile): CheckSummary {
  lockfile ??= getLockfile(projectRoot);
  const artifactIds = Object.keys(lockfile.artifacts);

  const results: CheckResult[] = [];
  let totalSize = 0;

  for (const artifactId of artifactIds) {
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
    const lockEntry = lockfile.artifacts[artifactId];

    const result: CheckResult = {
      artifactId,
      status: "ok",
      issues: [],
    };

    if (!fs.exists(artifactDir)) {
      result.status = "missing";
      result.issues.push("Directory not found");
      results.push(result);
      continue;
    }

    if (lockEntry?.files && Object.keys(lockEntry.files).length > 0) {
      const integrity = verifyIntegrity(artifactDir, lockEntry.files);

      if (!integrity.valid) {
        result.status = "drift";

        for (const file of integrity.missingFiles) {
          result.issues.push(`Missing: ${file}`);
        }

        for (const mod of integrity.modifiedFiles) {
          result.issues.push(`Modified: ${mod.path}`);
        }
      }
    }

    totalSize += getDirectorySize(artifactDir);
    results.push(result);
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const driftCount = results.filter((r) => r.status === "drift").length;
  const missingCount = results.filter((r) => r.status === "missing").length;

  return {
    results,
    totalSize,
    okCount,
    driftCount,
    missingCount,
    healthy: driftCount === 0 && missingCount === 0,
  };
}

