import { join } from "path"
import { fs } from "#/context"
import { REPORTS_DIR, SCAN_REPORT_FILE, EVAL_REPORT_FILE } from "#/config/paths/paths"
import type { ScanReportFile, EvalReportFile } from "./reports.types"

function ensureReportsDir(projectRoot: string): string {
  const reportsDir = join(projectRoot, REPORTS_DIR)

  if (!fs.exists(reportsDir)) {
    fs.mkdir(reportsDir, { recursive: true })
  }

  return reportsDir
}

export function writeScanReport(projectRoot: string, data: ScanReportFile): void {
  const reportsDir = ensureReportsDir(projectRoot)
  const filePath = join(reportsDir, SCAN_REPORT_FILE)
  fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

export function writeEvalReport(projectRoot: string, data: EvalReportFile): void {
  const reportsDir = ensureReportsDir(projectRoot)
  const filePath = join(reportsDir, EVAL_REPORT_FILE)
  fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

export function readAndConsumeScanReport(projectRoot: string): ScanReportFile | null {
  const filePath = join(projectRoot, REPORTS_DIR, SCAN_REPORT_FILE)

  if (!fs.exists(filePath)) {
    return null
  }

  const content = fs.readFile(filePath)
  fs.unlink(filePath)

  return JSON.parse(content) as ScanReportFile
}

export function readAndConsumeEvalReport(projectRoot: string): EvalReportFile | null {
  const filePath = join(projectRoot, REPORTS_DIR, EVAL_REPORT_FILE)

  if (!fs.exists(filePath)) {
    return null
  }

  const content = fs.readFile(filePath)
  fs.unlink(filePath)

  return JSON.parse(content) as EvalReportFile
}
