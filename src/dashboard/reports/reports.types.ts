import type { SecurityReport, EvalSummary } from "@grekt/engine"

export interface ScannerReportEntry {
  scanner: string
  results: Array<{ artifactId: string; report: SecurityReport; trusted?: boolean }>
}

export interface ScanReportFile {
  projectName: string
  triggeredBy: "cli" | "ci"
  scanners: ScannerReportEntry[]
}

export interface EvalReportFile {
  projectName: string
  triggeredBy: "cli" | "ci"
  summary: EvalSummary
}
