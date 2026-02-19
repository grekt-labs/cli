import { formatBytes, estimateTokens, type Lockfile } from "@grekt-labs/cli-engine";
import { success, warning, log, newline, colors, symbols } from "#/shared/ui/ui";
import type { CheckSummary } from "./check";

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

  newline();

  if (summary.healthy) {
    success(`All ${summary.okCount} artifact(s) are healthy`);
  } else {
    warning(`${summary.driftCount + summary.missingCount} artifact(s) have issues`);
  }
}
