import { execSync } from "child_process"
import type { SecurityReport, SecurityFinding, TrustBadge } from "@grekt/engine"
import type { Scanner } from "#/security/security.types"
import type { AguaraOutput, AguaraFinding, AguaraSeverity } from "./aguara.types"
import { resolveBinary } from "./binary"

let resolvedBinaryPath: string | null = null

const SEVERITY_MAP: Record<AguaraSeverity, SecurityFinding["severity"]> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
}

const DEDUCTION_MAP: Record<AguaraSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
}

function executeAguara(binaryPath: string, artifactDir: string): AguaraOutput {
  const result = execSync(
    `"${binaryPath}" scan "${artifactDir}" --format json`,
    {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "ignore"],
    },
  )

  return JSON.parse(result) as AguaraOutput
}

function mapFinding(finding: AguaraFinding): SecurityFinding {
  const severity = SEVERITY_MAP[finding.severity] ?? "medium"

  return {
    id: `aguara-${finding.rule_id}`,
    category: finding.category,
    severity,
    title: `${finding.rule_id} in ${finding.file_path}:${finding.line}`,
    description: `[${finding.analyzer}] ${finding.remediation}`,
    evidence: finding.matched_text,
    deduction: DEDUCTION_MAP[finding.severity] ?? 5,
    recommendation: finding.remediation,
  }
}

function determineBadge(score: number, findings: SecurityFinding[]): TrustBadge {
  const hasCritical = findings.some((f) => f.severity === "critical")
  const highCount = findings.filter((f) => f.severity === "high").length

  if (hasCritical) return "rejected"
  if (score < 50) return "rejected"
  if (score < 75) return "suspicious"
  if (score < 90 && highCount <= 2) return "conditional"
  if (score >= 90 && highCount === 0) return "certified"
  if (highCount > 2) return "suspicious"
  if (highCount > 0) return "conditional"
  return "certified"
}

function buildReport(output: AguaraOutput): SecurityReport {
  const findings = output.findings.map(mapFinding)
  const totalDeduction = findings.reduce((sum, f) => sum + f.deduction, 0)
  const score = Math.max(0, 100 - totalDeduction)

  return {
    score,
    badge: determineBadge(score, findings),
    findings,
    categoryScores: buildCategoryScores(output.findings),
    scannedAt: new Date().toISOString(),
    filesScanned: output.files_scanned,
  }
}

function buildCategoryScores(findings: AguaraFinding[]): Record<string, number> {
  const categories = new Map<string, number[]>()

  for (const finding of findings) {
    const deduction = DEDUCTION_MAP[finding.severity] ?? 5
    const existing = categories.get(finding.category) ?? []
    existing.push(deduction)
    categories.set(finding.category, existing)
  }

  const scores: Record<string, number> = {}
  for (const [category, deductions] of categories) {
    const totalDeduction = deductions.reduce((sum, d) => sum + d, 0)
    scores[category] = Math.max(0, 100 - totalDeduction)
  }

  return scores
}

export const aguaraScanner: Scanner = {
  name: "aguara",

  async available(): Promise<boolean> {
    resolvedBinaryPath = await resolveBinary()
    return resolvedBinaryPath !== null
  },

  async scan(artifactDir: string): Promise<SecurityReport> {
    if (!resolvedBinaryPath) {
      throw new Error("Aguara binary not available")
    }
    const output = executeAguara(resolvedBinaryPath, artifactDir)
    return buildReport(output)
  },
}
