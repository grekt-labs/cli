export interface AguaraOutput {
  findings: AguaraFinding[]
  files_scanned: number
  rules_loaded: number
  duration: string
}

export interface AguaraFinding {
  rule_id: string
  severity: AguaraSeverity
  category: string
  file_path: string
  line: number
  matched_text: string
  confidence: number
  remediation: string
  analyzer: string
  context_before?: string[]
  context_after?: string[]
}

export type AguaraSeverity = "critical" | "high" | "medium" | "low" | "info"

export interface BinaryMetadata {
  version: string
  downloadedAt: string
  lastCheck: string
}
