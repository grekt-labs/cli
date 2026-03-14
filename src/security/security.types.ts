import type { SecurityReport } from "@grekt/engine"

export interface Scanner {
  name: string
  available(): boolean | Promise<boolean>
  scan(artifactDir: string): Promise<SecurityReport>
}

export interface ScannerResult {
  scanner: string
  report: SecurityReport
}
