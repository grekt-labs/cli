import { join, resolve } from "path";
import { Command } from "commander";
import { requireInitialized } from "#/shared/guards/guards";
import { fs, cryptoProvider, getLockfile } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import {
  scanArtifactSecurity,
  isBadgeAtOrAbove,
  type SecurityReport,
  type TrustBadge,
} from "@grekt/engine";
import { parseSource, downloadFromSource, type ParsedSource } from "#/registry/sources/sources";
import { getSourceDisplayName } from "#/registry/registry";
import { getConfig, getProjectName } from "#/config/project/project";
import { isArtifactTrusted } from "#/artifact/mode/mode";
import { error, warning, info, log, newline, colors, symbols, spinner } from "#/shared/ui/ui";
import { enrichReportWithMcpFindings } from "#/mcp-security/mcp-security";
import { syncToDashboard } from "#/dashboard/dashboard";

const VALID_BADGES: TrustBadge[] = ["certified", "conditional", "suspicious", "rejected"];

const BADGE_COLORS: Record<string, (text: string) => string> = {
  certified: colors.success,
  conditional: colors.warning,
  suspicious: colors.error,
  rejected: colors.error,
};

export function formatBadge(badge: string): string {
  const colorFn = BADGE_COLORS[badge] ?? colors.dim;
  return colorFn(badge);
}

export function severityIcon(severity: string): string {
  switch (severity) {
    case "critical":
    case "high":
      return symbols.warning;
    case "medium":
      return colors.warning("~");
    case "low":
    case "info":
      return symbols.info;
    default:
      return symbols.bullet;
  }
}

function displaySingleReport(artifactLabel: string, report: SecurityReport): void {
  newline();
  log(`  ${colors.bold("Score:")} ${report.score} / 100`);
  log(`  ${colors.bold("Badge:")} ${formatBadge(report.badge)}`);

  if (report.findings.length > 0) {
    newline();
    log(`  ${colors.bold(`Findings (${report.findings.length}):`)}`);

    for (const finding of report.findings) {
      newline();
      log(`    ${severityIcon(finding.severity)} ${colors.dim(`[${finding.severity}]`)} ${finding.id}: ${finding.title}`);
      if (finding.evidence) {
        log(`      Evidence: ${colors.dim(`"${truncate(finding.evidence, 80)}"`)}`)
      }
      log(`      ${symbols.arrow} ${finding.recommendation}`);
    }
  }

  newline();
}

function displaySummaryTable(results: Array<{ artifactId: string; report: SecurityReport; trusted?: boolean }>): void {
  const maxIdLen = Math.max(...results.map((r) => r.artifactId.length), 8);

  newline();
  for (const { artifactId, report, trusted } of results) {
    const badgeStr = formatBadge(report.badge);
    const trustedLabel = trusted ? colors.dim(" (trusted)") : "";
    const findingsStr = report.findings.length > 0
      ? colors.dim(`${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}`)
      : "";
    const scoreStr = String(report.score).padStart(5);
    const icon = report.badge === "certified" || report.badge === "conditional"
      ? symbols.success
      : symbols.warning;

    log(`  ${icon} ${artifactId.padEnd(maxIdLen)}  ${scoreStr}  ${badgeStr}${trustedLabel}  ${findingsStr}`);
  }
  newline();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export interface FailOnResult {
  failed: boolean;
  failedArtifacts: Array<{ artifactId: string; badge: TrustBadge }>;
}

export function evaluateFailOn(
  results: Array<{ artifactId: string; report: SecurityReport; trusted?: boolean }>,
  threshold: TrustBadge,
): FailOnResult {
  const failedArtifacts: Array<{ artifactId: string; badge: TrustBadge }> = [];

  for (const { artifactId, report, trusted } of results) {
    if (trusted) continue;
    if (isBadgeAtOrAbove(report.badge, threshold)) {
      failedArtifacts.push({ artifactId, badge: report.badge });
    }
  }

  return { failed: failedArtifacts.length > 0, failedArtifacts };
}

function validateFailOnValue(value: string): TrustBadge {
  if (!VALID_BADGES.includes(value as TrustBadge)) {
    error(`Invalid --fail-on value: "${value}". Must be one of: ${VALID_BADGES.join(", ")}`);
    process.exit(1);
  }
  return value as TrustBadge;
}

export const scanCommand = new Command("scan")
  .description("Scan artifacts for security issues using AgentVerus")
  .argument("[source]", "Artifact source (@scope/name, github:user/repo, or local path)")
  .option("--json", "Output results as JSON")
  .option("--fail-on <badge>", "Exit with code 1 if any artifact badge meets or exceeds this threshold")
  .action(async (sourceArg: string | undefined, options: { json?: boolean; failOn?: string }) => {
    const projectRoot = process.cwd();
    const failOnThreshold = options.failOn ? validateFailOnValue(options.failOn) : undefined;

    if (!sourceArg) {
      await scanAllInstalled(projectRoot, options.json, failOnThreshold);
      return;
    }

    const source = parseSource(sourceArg);

    if (source.type === "local") {
      await scanSingleArtifact(sourceArg, options.json, failOnThreshold);
    } else {
      await scanRemoteArtifact(source, projectRoot, options.json, failOnThreshold);
    }
  });

async function scanRemoteArtifact(source: ParsedSource, projectRoot: string, jsonOutput?: boolean, failOnThreshold?: TrustBadge): Promise<void> {
  const displayName = getSourceDisplayName(source);
  const tempDir = join(projectRoot, ARTIFACTS_DIR, `.tmp-scan-${cryptoProvider.randomUUID()}`);

  try {
    if (!jsonOutput) {
      const spin = spinner(`Downloading ${colors.highlight(displayName)}...`);
      spin.start();

      fs.mkdir(tempDir, { recursive: true });
      const downloadResult = await downloadFromSource(source, tempDir, projectRoot);

      spin.stop();

      if (!downloadResult.success) {
        const reason = downloadResult.error || "Download failed";
        error(`Failed to download ${colors.highlight(displayName)}: ${reason}`);
        process.exit(1);
      }

      const scanSpin = spinner(`Scanning ${colors.highlight(displayName)}...`);
      scanSpin.start();

      try {
        const baseReport = await scanArtifactSecurity(fs, tempDir);
        const report = enrichReportWithMcpFindings(baseReport, tempDir);
        scanSpin.stop();

        log(`Scanning ${colors.highlight(displayName)}...`);
        displaySingleReport(displayName, report);

        if (failOnThreshold) {
          const result = evaluateFailOn([{ artifactId: displayName, report }], failOnThreshold);
          exitWithFailOnResult(result, failOnThreshold);
        }
      } catch (err) {
        scanSpin.stop();
        const message = err instanceof Error ? err.message : "Scan failed";
        error(`Failed to scan ${displayName}: ${message}`);
        process.exit(1);
      }
    } else {
      fs.mkdir(tempDir, { recursive: true });
      const downloadResult = await downloadFromSource(source, tempDir, projectRoot);

      if (!downloadResult.success) {
        const reason = downloadResult.error || "Download failed";
        console.log(JSON.stringify({ error: reason }));
        process.exit(1);
      }

      try {
        const baseReport = await scanArtifactSecurity(fs, tempDir);
        const report = enrichReportWithMcpFindings(baseReport, tempDir);
        console.log(JSON.stringify(report, null, 2));

        if (failOnThreshold) {
          const result = evaluateFailOn([{ artifactId: displayName, report }], failOnThreshold);
          if (result.failed) process.exit(1);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Scan failed";
        console.log(JSON.stringify({ error: message }));
        process.exit(1);
      }
    }
  } finally {
    if (fs.exists(tempDir)) {
      fs.rmdir(tempDir, { recursive: true });
    }
  }
}

async function scanSingleArtifact(artifactPath: string, jsonOutput?: boolean, failOnThreshold?: TrustBadge): Promise<void> {
  const resolvedPath = resolve(artifactPath);

  if (!fs.exists(resolvedPath)) {
    error(`Path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const stat = fs.stat(resolvedPath);
  const scanPath = stat.isDirectory ? resolvedPath : resolve(resolvedPath, "..");

  const label = artifactPath;

  if (!jsonOutput) {
    const spin = spinner(`Scanning ${colors.highlight(label)}...`);
    spin.start();

    try {
      const baseReport = await scanArtifactSecurity(fs, scanPath);
      const report = enrichReportWithMcpFindings(baseReport, scanPath);
      spin.stop();

      log(`Scanning ${colors.highlight(label)}...`);
      displaySingleReport(label, report);

      if (failOnThreshold) {
        const result = evaluateFailOn([{ artifactId: label, report }], failOnThreshold);
        exitWithFailOnResult(result, failOnThreshold);
      }
    } catch (err) {
      spin.stop();
      const message = err instanceof Error ? err.message : "Scan failed";
      error(`Failed to scan ${label}: ${message}`);
      process.exit(1);
    }
  } else {
    try {
      const baseReport = await scanArtifactSecurity(fs, scanPath);
      const report = enrichReportWithMcpFindings(baseReport, scanPath);
      console.log(JSON.stringify(report, null, 2));

      if (failOnThreshold) {
        const result = evaluateFailOn([{ artifactId: label, report }], failOnThreshold);
        if (result.failed) process.exit(1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      console.log(JSON.stringify({ error: message }));
      process.exit(1);
    }
  }
}

function exitWithFailOnResult(result: FailOnResult, threshold: TrustBadge): void {
  if (!result.failed) return;

  newline();
  error(`Scan failed: ${result.failedArtifacts.length} artifact${result.failedArtifacts.length === 1 ? "" : "s"} at or above "${threshold}" threshold`);
  for (const { artifactId, badge } of result.failedArtifacts) {
    log(`  ${symbols.warning} ${artifactId}: ${formatBadge(badge)}`);
  }
  newline();
  process.exit(1);
}

async function scanAllInstalled(projectRoot: string, jsonOutput?: boolean, failOnThreshold?: TrustBadge): Promise<void> {
  requireInitialized(projectRoot);

  const lockfile = getLockfile(projectRoot);
  const artifactIds = Object.keys(lockfile.artifacts);

  if (artifactIds.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({}));
    } else {
      info("No artifacts installed");
    }
    process.exit(0);
  }

  const config = getConfig(projectRoot);
  const trustKey = process.env.GREKT_TRUST_KEY;
  const artifactsDir = join(projectRoot, ARTIFACTS_DIR);
  const results: Array<{ artifactId: string; report: SecurityReport; trusted?: boolean }> = [];
  const errors: Array<{ artifactId: string; message: string }> = [];

  if (!jsonOutput) {
    log(`Scanning ${colors.bold(String(artifactIds.length))} artifact${artifactIds.length === 1 ? "" : "s"}...`);
  }

  for (const artifactId of artifactIds) {
    const artifactDir = join(artifactsDir, artifactId);

    if (!fs.exists(artifactDir)) {
      errors.push({ artifactId, message: "Not installed (directory missing)" });
      continue;
    }

    try {
      const baseReport = await scanArtifactSecurity(fs, artifactDir);
      const report = enrichReportWithMcpFindings(baseReport, artifactDir);
      const trusted = isArtifactTrusted(artifactId, config, trustKey);
      results.push({ artifactId, report, trusted });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      errors.push({ artifactId, message });
    }
  }

  if (jsonOutput) {
    const output: Record<string, SecurityReport | { error: string }> = {};
    for (const { artifactId, report } of results) {
      output[artifactId] = report;
    }
    for (const { artifactId, message } of errors) {
      output[artifactId] = { error: message };
    }
    console.log(JSON.stringify(output, null, 2));

    if (results.length > 0) {
      const projectName = getProjectName(projectRoot);
      await syncToDashboard(async (reporter) => {
        await reporter.reportScan(projectName, results, "cli");
      });
    }

    if (failOnThreshold) {
      const result = evaluateFailOn(results, failOnThreshold);
      if (result.failed) process.exit(1);
    }
    return;
  }

  if (results.length > 0) {
    displaySummaryTable(results);
  }

  for (const { artifactId, message } of errors) {
    warning(`${colors.highlight(artifactId)}: ${message}`);
  }

  if (results.length > 0) {
    const synced = await syncToDashboard(async (reporter) => {
      await reporter.reportScan(getProjectName(projectRoot), results, "cli");
    });

    if (synced) {
      newline();
      info("Scan results synced to dashboard.");
    }
  }

  if (failOnThreshold) {
    const result = evaluateFailOn(results, failOnThreshold);
    exitWithFailOnResult(result, failOnThreshold);
  }
}
