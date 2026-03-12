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

  test("returns false when reporter creation returns null", async () => {
    mockCreate.mockReturnValue(null)
    const callback = vi.fn()

    const result = await syncToDashboard(callback)

    expect(callback).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  test("returns true when callback succeeds", async () => {
    const fakeReporter = { reportProject: vi.fn() }
    mockCreate.mockReturnValue(fakeReporter)
    const callback = vi.fn()

    const result = await syncToDashboard(callback)

    expect(callback).toHaveBeenCalledWith(fakeReporter)
    expect(result).toBe(true)
  })

  test("returns false and warns on callback errors", async () => {
    const fakeReporter = {}
    mockCreate.mockReturnValue(fakeReporter)

    const result = await syncToDashboard(async () => {
      throw new Error("PocketBase 500: internal error")
    })

    expect(result).toBe(false)
    expect(mockWarning).toHaveBeenCalledWith("Dashboard: PocketBase 500: internal error")
  })

  test("returns false and warns on reporter creation errors", async () => {
    mockCreate.mockImplementation(() => {
      throw new Error("Invalid config")
    })

    const result = await syncToDashboard(async () => {})

    expect(result).toBe(false)
    expect(mockWarning).toHaveBeenCalledWith("Dashboard: Invalid config")
  })

  test("handles non-Error thrown values", async () => {
    const fakeReporter = {}
    mockCreate.mockReturnValue(fakeReporter)

    const result = await syncToDashboard(async () => {
      throw "string error"
    })

    expect(result).toBe(false)
    expect(mockWarning).toHaveBeenCalledWith("Dashboard: string error")
  })

  test("never throws regardless of what happens", async () => {
    mockCreate.mockImplementation(() => {
      throw new Error("boom")
    })

    await expect(syncToDashboard(async () => {})).resolves.toBe(false)
  })
})
