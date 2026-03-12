import type { SecurityReport, EvalSummary } from "@grekt/engine"

export interface ScanReportFile {
  projectName: string
  triggeredBy: "cli" | "ci"
  scanner: string
  results: Array<{ artifactId: string; report: SecurityReport; trusted?: boolean }>
}

export interface EvalReportFile {
  projectName: string
  triggeredBy: "cli" | "ci"
  summary: EvalSummary
}
