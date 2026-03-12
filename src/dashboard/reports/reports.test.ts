import { describe, test, expect, vi, beforeEach } from "vitest"
import { join } from "path"

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    exists: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
  },
}))

vi.mock("#/context", () => ({
  fs: mockFs,
}))

import { writeScanReport, writeEvalReport, readAndConsumeScanReport, readAndConsumeEvalReport } from "./reports"
import type { ScanReportFile, EvalReportFile } from "./reports.types"

const PROJECT_ROOT = "/test/project"
const REPORTS_DIR = join(PROJECT_ROOT, ".grekt/reports")

describe("reports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("writeScanReport", () => {
    test("creates reports directory if it does not exist", () => {
      mockFs.exists.mockReturnValue(false)

      const data: ScanReportFile = {
        projectName: "test-project",
        triggeredBy: "cli",
        scanner: "agentverus",
        results: [],
      }

      writeScanReport(PROJECT_ROOT, data)

      expect(mockFs.mkdir).toHaveBeenCalledWith(REPORTS_DIR, { recursive: true })
    })

    test("skips directory creation if it already exists", () => {
      mockFs.exists.mockReturnValue(true)

      const data: ScanReportFile = {
        projectName: "test-project",
        triggeredBy: "cli",
        scanner: "agentverus",
        results: [],
      }

      writeScanReport(PROJECT_ROOT, data)

      expect(mockFs.mkdir).not.toHaveBeenCalled()
    })

    test("writes scan report as JSON to scan.json", () => {
      mockFs.exists.mockReturnValue(true)

      const data: ScanReportFile = {
        projectName: "test-project",
        triggeredBy: "cli",
        scanner: "agentverus",
        results: [{ artifactId: "@scope/art", report: {} as never, trusted: false }],
      }

      writeScanReport(PROJECT_ROOT, data)

      const expectedPath = join(REPORTS_DIR, "scan.json")
      expect(mockFs.writeFile).toHaveBeenCalledWith(expectedPath, JSON.stringify(data, null, 2))
    })
  })

  describe("writeEvalReport", () => {
    test("writes eval report as JSON to eval.json", () => {
      mockFs.exists.mockReturnValue(true)

      const data: EvalReportFile = {
        projectName: "test-project",
        triggeredBy: "cli",
        summary: {} as never,
      }

      writeEvalReport(PROJECT_ROOT, data)

      const expectedPath = join(REPORTS_DIR, "eval.json")
      expect(mockFs.writeFile).toHaveBeenCalledWith(expectedPath, JSON.stringify(data, null, 2))
    })
  })

  describe("readAndConsumeScanReport", () => {
    test("returns null when scan report does not exist", () => {
      mockFs.exists.mockReturnValue(false)

      const result = readAndConsumeScanReport(PROJECT_ROOT)

      expect(result).toBeNull()
      expect(mockFs.readFile).not.toHaveBeenCalled()
    })

    test("reads, deletes, and returns scan report", () => {
      const reportData: ScanReportFile = {
        projectName: "test-project",
        triggeredBy: "cli",
        scanner: "agentverus",
        results: [],
      }

      mockFs.exists.mockReturnValue(true)
      mockFs.readFile.mockReturnValue(JSON.stringify(reportData))

      const result = readAndConsumeScanReport(PROJECT_ROOT)

      expect(result).toEqual(reportData)
      expect(mockFs.unlink).toHaveBeenCalledWith(join(REPORTS_DIR, "scan.json"))
    })
  })

  describe("readAndConsumeEvalReport", () => {
    test("returns null when eval report does not exist", () => {
      mockFs.exists.mockReturnValue(false)

      const result = readAndConsumeEvalReport(PROJECT_ROOT)

      expect(result).toBeNull()
    })

    test("reads, deletes, and returns eval report", () => {
      const reportData: EvalReportFile = {
        projectName: "test-project",
        triggeredBy: "cli",
        summary: {} as never,
      }

      mockFs.exists.mockReturnValue(true)
      mockFs.readFile.mockReturnValue(JSON.stringify(reportData))

      const result = readAndConsumeEvalReport(PROJECT_ROOT)

      expect(result).toEqual(reportData)
      expect(mockFs.unlink).toHaveBeenCalledWith(join(REPORTS_DIR, "eval.json"))
    })
  })
})
