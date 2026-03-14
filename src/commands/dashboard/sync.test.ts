import { describe, test, expect, vi, beforeEach } from "vitest"

const { mockGetLocalConfig, mockGetConfig, mockGetProjectName } = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn(),
  mockGetConfig: vi.fn(),
  mockGetProjectName: vi.fn(),
}))

vi.mock("#/config/project/project", () => ({
  getLocalConfig: mockGetLocalConfig,
  getConfig: mockGetConfig,
  getProjectName: mockGetProjectName,
}))

const { mockGetLockfile } = vi.hoisted(() => ({
  mockGetLockfile: vi.fn(),
}))

vi.mock("#/context", () => ({
  getLockfile: mockGetLockfile,
}))

const { mockSyncToDashboard } = vi.hoisted(() => ({
  mockSyncToDashboard: vi.fn(),
}))

vi.mock("#/dashboard/dashboard", () => ({
  syncToDashboard: mockSyncToDashboard,
}))

const { mockReadAndConsumeScanReport, mockReadAndConsumeEvalReport } = vi.hoisted(() => ({
  mockReadAndConsumeScanReport: vi.fn(),
  mockReadAndConsumeEvalReport: vi.fn(),
}))

vi.mock("#/dashboard/reports/reports", () => ({
  readAndConsumeScanReport: mockReadAndConsumeScanReport,
  readAndConsumeEvalReport: mockReadAndConsumeEvalReport,
}))

const { mockRequireInitialized } = vi.hoisted(() => ({
  mockRequireInitialized: vi.fn(),
}))

vi.mock("#/shared/guards/guards", () => ({
  requireInitialized: mockRequireInitialized,
}))

const { mockSuccess, mockInfo, mockWarning, mockLog, mockNewline } = vi.hoisted(() => ({
  mockSuccess: vi.fn(),
  mockInfo: vi.fn(),
  mockWarning: vi.fn(),
  mockLog: vi.fn(),
  mockNewline: vi.fn(),
}))

vi.mock("#/shared/ui/ui", () => ({
  success: mockSuccess,
  info: mockInfo,
  warning: mockWarning,
  log: mockLog,
  newline: mockNewline,
  colors: {
    success: (t: string) => t,
    dim: (t: string) => t,
    highlight: (t: string) => t,
    bold: (t: string) => t,
  },
}))

import { dashboardSyncCommand } from "./sync"

describe("dashboard sync command", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("throws on unknown sync target", async () => {
    await expect(
      dashboardSyncCommand.parseAsync(["unknown"], { from: "user" }),
    ).rejects.toThrow('Unknown sync target: "unknown"')
  })

  describe("registries subcommand", () => {
    test("shows info when no registries configured", async () => {
      mockGetLocalConfig.mockReturnValue(null)

      await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

      expect(mockInfo).toHaveBeenCalledWith("No registries configured. Nothing to sync.")
      expect(mockSyncToDashboard).not.toHaveBeenCalled()
    })

    test("shows info when registries object is empty", async () => {
      mockGetLocalConfig.mockReturnValue({ registries: {} })

      await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

      expect(mockInfo).toHaveBeenCalledWith("No registries configured. Nothing to sync.")
    })

    test("syncs registries to dashboard", async () => {
      const registries = {
        "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
      }
      mockGetLocalConfig.mockReturnValue({ registries })
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb({ reportRegistries: vi.fn().mockResolvedValue(1) })
        return true
      })

      await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

      expect(mockSyncToDashboard).toHaveBeenCalled()
      expect(mockSuccess).toHaveBeenCalledWith("Synced 1 registry to dashboard.")
    })
  })

  describe("full sync (no args)", () => {
    function setupFullSyncMocks() {
      mockGetConfig.mockReturnValue({ artifacts: {}, targets: [] })
      mockGetLockfile.mockReturnValue({ artifacts: { "@scope/a": { version: "1.0.0" } } })
      mockGetProjectName.mockReturnValue("test-project")
      mockGetLocalConfig.mockReturnValue(null)
      mockReadAndConsumeScanReport.mockReturnValue(null)
      mockReadAndConsumeEvalReport.mockReturnValue(null)
    }

    test("requires initialized project", async () => {
      setupFullSyncMocks()
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb({
          reportProject: vi.fn(),
          reportRegistries: vi.fn().mockResolvedValue(0),
          reportScan: vi.fn(),
          reportEval: vi.fn(),
          reconcileArtifacts: vi.fn().mockResolvedValue(0),
        })
        return true
      })

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockRequireInitialized).toHaveBeenCalled()
    })

    test("syncs project and artifacts", async () => {
      setupFullSyncMocks()
      const mockReporter = {
        reportProject: vi.fn(),
        reportRegistries: vi.fn().mockResolvedValue(0),
        reportScan: vi.fn(),
        reportEval: vi.fn(),
        reconcileArtifacts: vi.fn().mockResolvedValue(0),
      }
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb(mockReporter)
        return true
      })

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockReporter.reportProject).toHaveBeenCalled()
      expect(mockSuccess).toHaveBeenCalledWith("Dashboard sync complete.")
    })

    test("consumes scan report when available", async () => {
      setupFullSyncMocks()
      const scannerResults = [{ artifactId: "@scope/a", report: {}, trusted: false }]
      const scanReport = {
        projectName: "test-project",
        triggeredBy: "cli" as const,
        scanners: [{ scanner: "agentverus", results: scannerResults }],
      }
      mockReadAndConsumeScanReport.mockReturnValue(scanReport)

      const mockReporter = {
        reportProject: vi.fn(),
        reportRegistries: vi.fn().mockResolvedValue(0),
        reportScan: vi.fn(),
        reportEval: vi.fn(),
        reconcileArtifacts: vi.fn().mockResolvedValue(0),
      }
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb(mockReporter)
        return true
      })

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockReporter.reportScan).toHaveBeenCalledWith(
        "test-project",
        scannerResults,
        "cli",
        "agentverus",
      )
    })

    test("consumes eval report when available", async () => {
      setupFullSyncMocks()
      const evalReport = {
        projectName: "test-project",
        triggeredBy: "cli" as const,
        summary: { totalEvals: 5, totalIssues: 0, results: [] },
      }
      mockReadAndConsumeEvalReport.mockReturnValue(evalReport)

      const mockReporter = {
        reportProject: vi.fn(),
        reportRegistries: vi.fn().mockResolvedValue(0),
        reportScan: vi.fn(),
        reportEval: vi.fn(),
        reconcileArtifacts: vi.fn().mockResolvedValue(0),
      }
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb(mockReporter)
        return true
      })

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockReporter.reportEval).toHaveBeenCalledWith(
        evalReport.summary,
        "test-project",
        "cli",
      )
    })

    test("reconciles stale artifacts", async () => {
      setupFullSyncMocks()
      const mockReporter = {
        reportProject: vi.fn(),
        reportRegistries: vi.fn().mockResolvedValue(0),
        reportScan: vi.fn(),
        reportEval: vi.fn(),
        reconcileArtifacts: vi.fn().mockResolvedValue(2),
      }
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb(mockReporter)
        return true
      })

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockReporter.reconcileArtifacts).toHaveBeenCalledWith(
        "test-project",
        ["@scope/a"],
      )
    })

    test("shows warning when sync is not configured", async () => {
      setupFullSyncMocks()
      mockSyncToDashboard.mockResolvedValue(false)

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockWarning).toHaveBeenCalledWith("Dashboard sync skipped (not configured or failed).")
    })

    test("syncs registries when configured", async () => {
      setupFullSyncMocks()
      mockGetLocalConfig.mockReturnValue({
        registries: {
          "@company": { type: "gitlab", host: "gitlab.com", project: "group/artifacts" },
        },
      })

      const mockReporter = {
        reportProject: vi.fn(),
        reportRegistries: vi.fn().mockResolvedValue(1),
        reportScan: vi.fn(),
        reportEval: vi.fn(),
        reconcileArtifacts: vi.fn().mockResolvedValue(0),
      }
      mockSyncToDashboard.mockImplementation(async (cb: Function) => {
        await cb(mockReporter)
        return true
      })

      await dashboardSyncCommand.parseAsync([], { from: "user" })

      expect(mockReporter.reportRegistries).toHaveBeenCalled()
    })
  })
})
