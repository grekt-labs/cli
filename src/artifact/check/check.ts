import { verifyIntegrity, getDirectorySize, fs, getLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { formatBytes, estimateTokens, type Lockfile } from "@grekt-labs/cli-engine";
import { success, warning, log, newline, colors, symbols } from "#/shared/ui/ui";

// TODO: Make this configurable via grekt.yaml or config
// Disabled for now - 10KB was too low, needs proper configuration
// const CONTEXT_WARNING_THRESHOLD = 10 * 1024;

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

/**
 * Display check results (verbose output for standalone check command)
 */
export function displayCheckResults(summary: CheckSummary, lockfile: Lockfile): void {
  log(colors.bold("Checking artifacts...\n"));

  for (const result of summary.results) {
    const version = lockfile.artifacts[result.artifactId]?.version || "?";

    if (result.status === "ok") {
      log(`${symbols.success} ${colors.highlight(result.artifactId)} ${colors.dim(`v${version}`)} - OK`);
    } else if (result.status === "drift") {
      log(`${symbols.warning} ${colors.highlight(result.artifactId)} ${colors.dim(`v${version}`)} - ${colors.warning("DRIFT DETECTED")}`);
      for (const issue of result.issues) {
        log(`  ${colors.dim("•")} ${issue}`);
      }
    } else if (result.status === "missing") {
      log(`${symbols.error} ${colors.highlight(result.artifactId)} - ${colors.error("MISSING FILES")}`);
      for (const issue of result.issues) {
        log(`  ${colors.dim("•")} ${issue}`);
      }
    }
  }

  newline();
  log(colors.bold("Context summary:\n"));

  const tokens = estimateTokens(summary.totalSize);
  log(`  Total size: ${formatBytes(summary.totalSize)} (~${tokens.toLocaleString()} tokens)`);

  // TODO: Re-enable with configurable threshold
  // if (summary.totalSize > CONTEXT_WARNING_THRESHOLD) {
  //   warning("Total context exceeds threshold. Consider:");
  //   log("  • Removing unused artifacts");
  //   log("  • Using smaller/more focused artifacts");
  // }

  newline();

  if (summary.healthy) {
    success(`All ${summary.okCount} artifact(s) are healthy`);
  } else {
    warning(`${summary.driftCount + summary.missingCount} artifact(s) have issues`);
  }
}

/**
 * Display compact check results
 */
export function displayCompactCheckResults(summary: CheckSummary): void {
  newline();
  log(colors.bold("Integrity check:"));

  if (summary.healthy) {
    success(`All ${summary.okCount} artifact(s) verified`);
  } else {
    warning(`${summary.driftCount + summary.missingCount} artifact(s) have issues`);

    for (const result of summary.results) {
      if (result.status !== "ok") {
        log(`  ${symbols.warning} ${result.artifactId}: ${result.status}`);
      }
    }
  }
}
