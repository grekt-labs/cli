import { describe, test, expect, vi, beforeEach } from "vitest"

const { mockGetLocalConfig } = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn(),
}))

vi.mock("#/config/project/project", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

const { mockSyncToDashboard } = vi.hoisted(() => ({
  mockSyncToDashboard: vi.fn(),
}))

vi.mock("#/dashboard/dashboard", () => ({
  syncToDashboard: mockSyncToDashboard,
}))

const { mockSuccess, mockInfo, mockNewline } = vi.hoisted(() => ({
  mockSuccess: vi.fn(),
  mockInfo: vi.fn(),
  mockNewline: vi.fn(),
}))

vi.mock("#/shared/ui/ui", () => ({
  success: mockSuccess,
  info: mockInfo,
  newline: mockNewline,
}))

import { dashboardSyncCommand } from "./sync"

describe("dashboard sync command", () => {
  beforeEach(() => {
    mockGetLocalConfig.mockClear()
    mockSyncToDashboard.mockClear()
    mockSuccess.mockClear()
    mockInfo.mockClear()
  })

  test("throws on unknown sync target", async () => {
    await expect(
      dashboardSyncCommand.parseAsync(["unknown"], { from: "user" }),
    ).rejects.toThrow('Unknown sync target: "unknown"')
  })

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
    expect(mockSyncToDashboard).not.toHaveBeenCalled()
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

  test("pluralizes registries count", async () => {
    const registries = {
      "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
      "@other": { type: "gitlab", host: "gitlab.other.com", project: "team/artifacts" },
    }
    mockGetLocalConfig.mockReturnValue({ registries })
    mockSyncToDashboard.mockImplementation(async (cb: Function) => {
      await cb({ reportRegistries: vi.fn().mockResolvedValue(2) })
      return true
    })

    await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

    expect(mockSuccess).toHaveBeenCalledWith("Synced 2 registries to dashboard.")
  })
})
