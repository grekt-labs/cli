import { describe, test, expect } from "vitest"
import { buildSummaryReport } from "./security"
import type { SecurityReport } from "@grekt/engine"
import type { ScannerResult } from "./security.types"

function makeReport(overrides: Partial<SecurityReport> = {}): SecurityReport {
  return {
    score: 100,
    badge: "certified",
    findings: [],
    categoryScores: {},
    scannedAt: new Date().toISOString(),
    filesScanned: 1,
    ...overrides,
  }
}

describe("buildSummaryReport", () => {
  test("returns default certified report for empty scanner results", () => {
    const result = buildSummaryReport([])
    expect(result.score).toBe(100)
    expect(result.badge).toBe("certified")
    expect(result.findings).toHaveLength(0)
  })

  test("returns the single report unchanged when only one scanner", () => {
    const report = makeReport({ score: 85, badge: "conditional" })
    const scannerResults: ScannerResult[] = [{ scanner: "agentverus", report }]

    const result = buildSummaryReport(scannerResults)
    expect(result).toBe(report)
  })

  test("takes minimum score across scanners", () => {
    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ score: 90 }) },
      { scanner: "aguara", report: makeReport({ score: 70 }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.score).toBe(70)
  })

  test("takes worst badge across scanners", () => {
    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ badge: "certified" }) },
      { scanner: "aguara", report: makeReport({ badge: "suspicious" }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.badge).toBe("suspicious")
  })

  test("merges findings from all scanners", () => {
    const finding1 = {
      id: "av-1",
      category: "content",
      severity: "medium" as const,
      title: "AgentVerus finding",
      description: "test",
      evidence: "ev1",
      deduction: 5,
      recommendation: "fix it",
    }
    const finding2 = {
      id: "ag-1",
      category: "prompt-injection",
      severity: "high" as const,
      title: "Aguara finding",
      description: "test",
      evidence: "ev2",
      deduction: 10,
      recommendation: "fix it too",
    }

    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ findings: [finding1] }) },
      { scanner: "aguara", report: makeReport({ findings: [finding2] }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.findings).toHaveLength(2)
    expect(result.findings).toContain(finding1)
    expect(result.findings).toContain(finding2)
  })

  test("takes minimum category score when categories overlap", () => {
    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ categoryScores: { content: 90, structure: 100 } }) },
      { scanner: "aguara", report: makeReport({ categoryScores: { content: 70, injection: 80 } }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.categoryScores["content"]).toBe(70)
    expect(result.categoryScores["structure"]).toBe(100)
    expect(result.categoryScores["injection"]).toBe(80)
  })

  test("takes maximum filesScanned across scanners", () => {
    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ filesScanned: 5 }) },
      { scanner: "aguara", report: makeReport({ filesScanned: 12 }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.filesScanned).toBe(12)
  })

  test("rejected badge wins over all others", () => {
    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ badge: "conditional" }) },
      { scanner: "aguara", report: makeReport({ badge: "rejected" }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.badge).toBe("rejected")
  })

  test("certified badge loses to any worse badge", () => {
    const scannerResults: ScannerResult[] = [
      { scanner: "agentverus", report: makeReport({ badge: "certified" }) },
      { scanner: "aguara", report: makeReport({ badge: "conditional" }) },
    ]

    const result = buildSummaryReport(scannerResults)
    expect(result.badge).toBe("conditional")
  })
})
