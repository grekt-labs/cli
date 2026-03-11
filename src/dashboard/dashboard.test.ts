import { describe, test, expect, vi, beforeEach } from "vitest"

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock("#/dashboard/reporter/reporter", () => ({
  DashboardReporter: {
    create: mockCreate,
  },
}))

const { mockWarning } = vi.hoisted(() => ({
  mockWarning: vi.fn(),
}))

vi.mock("#/shared/ui/ui", () => ({
  warning: mockWarning,
}))

import { syncToDashboard } from "./dashboard"

describe("syncToDashboard", () => {
  beforeEach(() => {
    mockCreate.mockClear()
    mockWarning.mockClear()
  })

  test("does nothing when reporter creation returns null", async () => {
    mockCreate.mockResolvedValue(null)
    const callback = vi.fn()

    await syncToDashboard(callback)

    expect(callback).not.toHaveBeenCalled()
  })

  test("calls callback with reporter when available", async () => {
    const fakeReporter = { reportProject: vi.fn() }
    mockCreate.mockResolvedValue(fakeReporter)
    const callback = vi.fn()

    await syncToDashboard(callback)

    expect(callback).toHaveBeenCalledWith(fakeReporter)
  })

  test("catches and warns on callback errors", async () => {
    const fakeReporter = {}
    mockCreate.mockResolvedValue(fakeReporter)

    await syncToDashboard(async () => {
      throw new Error("PocketBase 500: internal error")
    })

    expect(mockWarning).toHaveBeenCalledWith("Dashboard: PocketBase 500: internal error")
  })

  test("catches and warns on reporter creation errors", async () => {
    mockCreate.mockRejectedValue(new Error("Network unreachable"))

    await syncToDashboard(async () => {})

    expect(mockWarning).toHaveBeenCalledWith("Dashboard: Network unreachable")
  })

  test("handles non-Error thrown values", async () => {
    const fakeReporter = {}
    mockCreate.mockResolvedValue(fakeReporter)

    await syncToDashboard(async () => {
      throw "string error"
    })

    expect(mockWarning).toHaveBeenCalledWith("Dashboard: string error")
  })

  test("never throws regardless of what happens", async () => {
    mockCreate.mockRejectedValue(new Error("boom"))

    await expect(syncToDashboard(async () => {})).resolves.toBeUndefined()
  })
})
