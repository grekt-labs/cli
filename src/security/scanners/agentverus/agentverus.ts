import { scanArtifactSecurity, type SecurityReport } from "@grekt/engine"
import { fs } from "#/context"
import { enrichReportWithMcpFindings } from "./mcp-enrichment"
import type { Scanner } from "#/security/security.types"

export const agentverusScanner: Scanner = {
  name: "agentverus",

  available() {
    return true
  },

  async scan(artifactDir: string): Promise<SecurityReport> {
    const baseReport = await scanArtifactSecurity(fs, artifactDir)
    return enrichReportWithMcpFindings(baseReport, artifactDir)
  },
}
