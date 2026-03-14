import { join, resolve } from "path"
import { Command } from "commander"
import { requireInitialized } from "#/shared/guards/guards"
import { fs, getLockfile, lockfileExists } from "#/context"
import { ARTIFACTS_DIR } from "#/config/paths/paths"
import { isBadgeAtOrAbove, type SecurityReport, type TrustBadge } from "@grekt/engine"
import { parseSource, downloadFromSource, type ParsedSource } from "#/registry/sources/sources"
import { getSourceDisplayName } from "#/registry/registry"
import { getConfig, getProjectName } from "#/config/project/project"
import { isArtifactTrusted } from "#/artifact/mode/mode"
import { error, warning, info, log, newline, colors, symbols, spinner } from "#/shared/ui/ui"
import { cryptoProvider } from "#/context"
import { runScanners, buildSummaryReport, type ArtifactScanResult } from "#/security/security"
import type { ScannerResult } from "#/security/security.types"
import { writeScanReport } from "#/dashboard/reports/reports"
import type { ScannerReportEntry } from "#/dashboard/reports/reports.types"

const VALID_BADGES: TrustBadge[] = ["certified", "conditional", "suspicious", "rejected"]

const BADGE_COLORS: Record<string, (text: string) => string> = {
  certified: colors.success,
  conditional: colors.warning,
  suspicious: colors.error,
  rejected: colors.error,
}

export function formatBadge(badge: string): string {
  const colorFn = BADGE_COLORS[badge] ?? colors.dim
  return colorFn(badge)
}

export function severityIcon(severity: string): string {
  switch (severity) {
    case "critical":
    case "high":
      return symbols.warning
    case "medium":
      return colors.warning("~")
    case "low":
    case "info":
      return symbols.info
    default:
      return symbols.bullet
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

export interface FailOnResult {
  failed: boolean
  failedArtifacts: Array<{ artifactId: string; badge: TrustBadge }>
}

export function evaluateFailOn(
  results: ArtifactScanResult[],
  threshold: TrustBadge,
): FailOnResult {
  const failedArtifacts: Array<{ artifactId: string; badge: TrustBadge }> = []

  for (const { artifactId, summary, trusted } of results) {
    if (trusted) continue
    if (isBadgeAtOrAbove(summary.badge, threshold)) {
      failedArtifacts.push({ artifactId, badge: summary.badge })
    }
  }

  return { failed: failedArtifacts.length > 0, failedArtifacts }
}

function validateFailOnValue(value: string): TrustBadge {
  if (!VALID_BADGES.includes(value as TrustBadge)) {
    error(`Invalid --fail-on value: "${value}". Must be one of: ${VALID_BADGES.join(", ")}`)
    process.exit(1)
  }
  return value as TrustBadge
}

// -- Display helpers --

function displaySingleResult(label: string, result: ArtifactScanResult): void {
  newline()
  log(`  ${colors.bold("Summary:")}`)
  log(`    ${colors.bold("Score:")} ${result.summary.score} / 100`)
  log(`    ${colors.bold("Badge:")} ${formatBadge(result.summary.badge)}`)

  for (const { scanner, report } of result.scanners) {
    newline()
    log(`  ${colors.bold(`[${scanner}]`)} Score: ${report.score} / 100  Badge: ${formatBadge(report.badge)}`)

    if (report.findings.length > 0) {
      log(`    ${colors.bold(`Findings (${report.findings.length}):`)}`);

      for (const finding of report.findings) {
        newline()
        log(`      ${severityIcon(finding.severity)} ${colors.dim(`[${finding.severity}]`)} ${finding.id}: ${finding.title}`)
        if (finding.evidence) {
          log(`        Evidence: ${colors.dim(`"${truncate(finding.evidence, 80)}"`)}`);
        }
        log(`        ${symbols.arrow} ${finding.recommendation}`)
      }
    }
  }

  newline()
}

function displaySummaryTable(results: ArtifactScanResult[]): void {
  const maxIdLen = Math.max(...results.map((r) => r.artifactId.length), 8)
  const scannerNames = [...new Set(results.flatMap((r) => r.scanners.map((s) => s.scanner)))]

  newline()
  for (const { artifactId, summary, scanners, trusted } of results) {
    const trustedLabel = trusted ? colors.dim(" (trusted)") : ""
    const findingsStr = summary.findings.length > 0
      ? colors.dim(`${summary.findings.length} finding${summary.findings.length === 1 ? "" : "s"}`)
      : ""
    const scoreStr = String(summary.score).padStart(5)
    const icon = summary.badge === "certified" || summary.badge === "conditional"
      ? symbols.success
      : symbols.warning

    const scannerScores = scannerNames.map((name) => {
      const match = scanners.find((s) => s.scanner === name)
      return match ? colors.dim(`${name}:${match.report.score}`) : colors.dim(`${name}:-`)
    }).join("  ")

    log(`  ${icon} ${artifactId.padEnd(maxIdLen)}  ${scoreStr}  ${formatBadge(summary.badge)}${trustedLabel}  ${scannerScores}  ${findingsStr}`)
  }
  newline()
}

// -- Scan a single artifact directory with all scanners --

async function scanArtifactDir(artifactDir: string): Promise<ScannerResult[]> {
  return runScanners(artifactDir)
}

// -- Command actions --

async function scanRemoteArtifact(source: ParsedSource, projectRoot: string, jsonOutput?: boolean, failOnThreshold?: TrustBadge): Promise<void> {
  const displayName = getSourceDisplayName(source)
  const tempDir = join(projectRoot, ARTIFACTS_DIR, `.tmp-scan-${cryptoProvider.randomUUID()}`)

  try {
    if (!jsonOutput) {
      const spin = spinner(`Downloading ${colors.highlight(displayName)}...`)
      spin.start()
      fs.mkdir(tempDir, { recursive: true })
      const downloadResult = await downloadFromSource(source, tempDir, projectRoot)
      spin.stop()

      if (!downloadResult.success) {
        error(`Failed to download ${colors.highlight(displayName)}: ${downloadResult.error || "Download failed"}`)
        process.exit(1)
      }

      const scanSpin = spinner(`Scanning ${colors.highlight(displayName)}...`)
      scanSpin.start()

      try {
        const scannerResults = await scanArtifactDir(tempDir)
        scanSpin.stop()

        const summary = buildSummaryReport(scannerResults)
        const result: ArtifactScanResult = { artifactId: displayName, scanners: scannerResults, summary }

        log(`Scanning ${colors.highlight(displayName)}...`)
        displaySingleResult(displayName, result)

        if (failOnThreshold) {
          const failResult = evaluateFailOn([result], failOnThreshold)
          exitWithFailOnResult(failResult, failOnThreshold)
        }
      } catch (err) {
        scanSpin.stop()
        error(`Failed to scan ${displayName}: ${err instanceof Error ? err.message : "Scan failed"}`)
        process.exit(1)
      }
    } else {
      fs.mkdir(tempDir, { recursive: true })
      const downloadResult = await downloadFromSource(source, tempDir, projectRoot)

      if (!downloadResult.success) {
        console.log(JSON.stringify({ error: downloadResult.error || "Download failed" }))
        process.exit(1)
      }

      try {
        const scannerResults = await scanArtifactDir(tempDir)
        const summary = buildSummaryReport(scannerResults)
        console.log(JSON.stringify({ summary, scanners: formatScannersJson(scannerResults) }, null, 2))

        if (failOnThreshold) {
          const result: ArtifactScanResult = { artifactId: displayName, scanners: scannerResults, summary }
          const failResult = evaluateFailOn([result], failOnThreshold)
          if (failResult.failed) process.exit(1)
        }
      } catch (err) {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Scan failed" }))
        process.exit(1)
      }
    }
  } finally {
    if (fs.exists(tempDir)) {
      fs.rmdir(tempDir, { recursive: true })
    }
  }
}

async function scanSingleArtifact(artifactPath: string, jsonOutput?: boolean, failOnThreshold?: TrustBadge): Promise<void> {
  const resolvedPath = resolve(artifactPath)

  if (!fs.exists(resolvedPath)) {
    error(`Path does not exist: ${resolvedPath}`)
    process.exit(1)
  }

  const stat = fs.stat(resolvedPath)
  const scanPath = stat.isDirectory ? resolvedPath : resolve(resolvedPath, "..")
  const label = artifactPath

  if (!jsonOutput) {
    const spin = spinner(`Scanning ${colors.highlight(label)}...`)
    spin.start()

    try {
      const scannerResults = await scanArtifactDir(scanPath)
      spin.stop()

      const summary = buildSummaryReport(scannerResults)
      const result: ArtifactScanResult = { artifactId: label, scanners: scannerResults, summary }

      log(`Scanning ${colors.highlight(label)}...`)
      displaySingleResult(label, result)

      if (failOnThreshold) {
        const failResult = evaluateFailOn([result], failOnThreshold)
        exitWithFailOnResult(failResult, failOnThreshold)
      }
    } catch (err) {
      spin.stop()
      error(`Failed to scan ${label}: ${err instanceof Error ? err.message : "Scan failed"}`)
      process.exit(1)
    }
  } else {
    try {
      const scannerResults = await scanArtifactDir(scanPath)
      const summary = buildSummaryReport(scannerResults)
      console.log(JSON.stringify({ summary, scanners: formatScannersJson(scannerResults) }, null, 2))

      if (failOnThreshold) {
        const result: ArtifactScanResult = { artifactId: label, scanners: scannerResults, summary }
        const failResult = evaluateFailOn([result], failOnThreshold)
        if (failResult.failed) process.exit(1)
      }
    } catch (err) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : "Scan failed" }))
      process.exit(1)
    }
  }
}

async function scanAllInstalled(projectRoot: string, jsonOutput?: boolean, failOnThreshold?: TrustBadge): Promise<void> {
  requireInitialized(projectRoot)

  const lockfile = getLockfile(projectRoot)
  const artifactIds = Object.keys(lockfile.artifacts)

  if (artifactIds.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({}))
    } else {
      info("No artifacts installed")
    }
    process.exit(0)
  }

  const config = getConfig(projectRoot)
  const trustKey = process.env.GREKT_TRUST_KEY
  const artifactsDir = join(projectRoot, ARTIFACTS_DIR)
  const results: ArtifactScanResult[] = []
  const errors: Array<{ artifactId: string; message: string }> = []

  if (!jsonOutput) {
    log(`Scanning ${colors.bold(String(artifactIds.length))} artifact${artifactIds.length === 1 ? "" : "s"}...`)
  }

  for (const artifactId of artifactIds) {
    const artifactDir = join(artifactsDir, artifactId)

    if (!fs.exists(artifactDir)) {
      errors.push({ artifactId, message: "Not installed (directory missing)" })
      continue
    }

    try {
      const scannerResults = await scanArtifactDir(artifactDir)
      const summary = buildSummaryReport(scannerResults)
      const trusted = isArtifactTrusted(artifactId, config, trustKey)
      results.push({ artifactId, scanners: scannerResults, summary, trusted })
    } catch (err) {
      errors.push({ artifactId, message: err instanceof Error ? err.message : "Scan failed" })
    }
  }

  if (jsonOutput) {
    const output: Record<string, { summary: SecurityReport; scanners: Record<string, SecurityReport> } | { error: string }> = {}
    for (const { artifactId, summary, scanners } of results) {
      output[artifactId] = { summary, scanners: formatScannersJson(scanners) }
    }
    for (const { artifactId, message } of errors) {
      output[artifactId] = { error: message }
    }
    console.log(JSON.stringify(output, null, 2))
  } else {
    if (results.length > 0) {
      displaySummaryTable(results)
    }

    for (const { artifactId, message } of errors) {
      warning(`${colors.highlight(artifactId)}: ${message}`)
    }
  }

  if (results.length > 0) {
    const projectName = getProjectName(projectRoot)
    writeScanReport(projectRoot, {
      projectName,
      triggeredBy: "cli",
      scanners: buildScannerReportEntries(results),
    })

    if (!jsonOutput) {
      newline()
      info("Scan report saved to .grekt/reports/scan.json")
    }
  }

  if (failOnThreshold) {
    const failResult = evaluateFailOn(results, failOnThreshold)
    if (jsonOutput) {
      if (failResult.failed) process.exit(1)
    } else {
      exitWithFailOnResult(failResult, failOnThreshold)
    }
  }
}

// -- Helpers --

function formatScannersJson(scannerResults: ScannerResult[]): Record<string, SecurityReport> {
  const output: Record<string, SecurityReport> = {}
  for (const { scanner, report } of scannerResults) {
    output[scanner] = report
  }
  return output
}

/**
 * Group artifact results by scanner for the report file.
 * Each scanner gets its own entry with all artifact results.
 */
function buildScannerReportEntries(results: ArtifactScanResult[]): ScannerReportEntry[] {
  const byScanner = new Map<string, ScannerReportEntry>()

  for (const { artifactId, scanners, trusted } of results) {
    for (const { scanner, report } of scanners) {
      let entry = byScanner.get(scanner)
      if (!entry) {
        entry = { scanner, results: [] }
        byScanner.set(scanner, entry)
      }
      entry.results.push({ artifactId, report, trusted })
    }
  }

  return [...byScanner.values()]
}

function exitWithFailOnResult(result: FailOnResult, threshold: TrustBadge): void {
  if (!result.failed) return

  newline()
  error(`Scan failed: ${result.failedArtifacts.length} artifact${result.failedArtifacts.length === 1 ? "" : "s"} at or above "${threshold}" threshold`)
  for (const { artifactId, badge } of result.failedArtifacts) {
    log(`  ${symbols.warning} ${artifactId}: ${formatBadge(badge)}`)
  }
  newline()
  process.exit(1)
}

/**
 * Check if an artifact is already installed locally (in lockfile + directory exists).
 * Returns the local directory path if found, undefined otherwise.
 */
export function resolveInstalledArtifactDir(source: ParsedSource, projectRoot: string): string | undefined {
  if (!lockfileExists(projectRoot)) return undefined

  const displayName = getSourceDisplayName(source)
  const lockfile = getLockfile(projectRoot)

  if (!lockfile.artifacts[displayName]) return undefined

  const localDir = join(projectRoot, ARTIFACTS_DIR, displayName)

  if (!fs.exists(localDir)) return undefined

  return localDir
}

// -- Command --

export const scanCommand = new Command("scan")
  .description("Scan artifacts for security issues")
  .argument("[source]", "Artifact source (@scope/name, github:user/repo, or local path)")
  .option("--json", "Output results as JSON")
  .option("--fail-on <badge>", "Exit with code 1 if any artifact badge meets or exceeds this threshold")
  .action(async (sourceArg: string | undefined, options: { json?: boolean; failOn?: string }) => {
    const projectRoot = process.cwd()
    const failOnThreshold = options.failOn ? validateFailOnValue(options.failOn) : undefined

    if (!sourceArg) {
      await scanAllInstalled(projectRoot, options.json, failOnThreshold)
      return
    }

    const source = parseSource(sourceArg)

    if (source.type === "local") {
      await scanSingleArtifact(sourceArg, options.json, failOnThreshold)
    } else {
      const localDir = resolveInstalledArtifactDir(source, projectRoot)

      if (localDir) {
        if (!options.json) {
          info(`Using local copy of ${colors.highlight(getSourceDisplayName(source))}`)
        }
        await scanSingleArtifact(localDir, options.json, failOnThreshold)
      } else {
        await scanRemoteArtifact(source, projectRoot, options.json, failOnThreshold)
      }
    }
  })
