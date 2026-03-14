import type { SecurityReport, TrustBadge } from "@grekt/engine"
import type { Scanner, ScannerResult } from "./security.types"
import { registeredScanners } from "./scanners/scanners"

export interface ArtifactScanResult {
  artifactId: string
  scanners: ScannerResult[]
  summary: SecurityReport
  trusted?: boolean
}

/**
 * Resolve which scanners are currently available.
 */
async function getAvailableScanners(): Promise<Scanner[]> {
  const checks = await Promise.all(
    registeredScanners.map(async (scanner) => ({
      scanner,
      available: await scanner.available(),
    })),
  )

  return checks.filter((c) => c.available).map((c) => c.scanner)
}

/**
 * Run all available scanners on a single artifact directory.
 */
export async function runScanners(artifactDir: string): Promise<ScannerResult[]> {
  const scanners = await getAvailableScanners()

  const results = await Promise.all(
    scanners.map(async (scanner): Promise<ScannerResult | null> => {
      try {
        const report = await scanner.scan(artifactDir)
        return { scanner: scanner.name, report }
      } catch {
        return null
      }
    }),
  )

  return results.filter((r): r is ScannerResult => r !== null)
}

/**
 * Build a combined summary from multiple scanner results.
 * Score: minimum across scanners (most conservative).
 * Badge: worst across scanners.
 * Findings: merged from all scanners.
 */
export function buildSummaryReport(scannerResults: ScannerResult[]): SecurityReport {
  if (scannerResults.length === 0) {
    return {
      score: 100,
      badge: "certified",
      findings: [],
      categoryScores: {},
      scannedAt: new Date().toISOString(),
      filesScanned: 0,
    }
  }

  if (scannerResults.length === 1) {
    return scannerResults[0].report
  }

  const score = Math.min(...scannerResults.map((r) => r.report.score))
  const badge = worstBadge(scannerResults.map((r) => r.report.badge))
  const findings = scannerResults.flatMap((r) => r.report.findings)
  const filesScanned = Math.max(...scannerResults.map((r) => r.report.filesScanned))
  const categoryScores = mergeCategoryScores(scannerResults)

  return {
    score,
    badge,
    findings,
    categoryScores,
    scannedAt: new Date().toISOString(),
    filesScanned,
  }
}

const BADGE_SEVERITY_ORDER: TrustBadge[] = ["certified", "conditional", "suspicious", "rejected"]

function worstBadge(badges: TrustBadge[]): TrustBadge {
  let worstIndex = 0
  for (const badge of badges) {
    const index = BADGE_SEVERITY_ORDER.indexOf(badge)
    if (index > worstIndex) {
      worstIndex = index
    }
  }
  return BADGE_SEVERITY_ORDER[worstIndex]
}

/**
 * Merge category scores: for overlapping categories, take the minimum.
 */
function mergeCategoryScores(results: ScannerResult[]): Record<string, number> {
  const merged: Record<string, number> = {}

  for (const { report } of results) {
    for (const [category, score] of Object.entries(report.categoryScores)) {
      if (merged[category] === undefined || score < merged[category]) {
        merged[category] = score
      }
    }
  }

  return merged
}
