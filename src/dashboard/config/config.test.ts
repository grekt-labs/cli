import { describe, test, expect, vi, beforeEach } from "vitest"

const { mockGetLocalConfig } = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn(),
}))

vi.mock("#/config/project/project", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

import { getDashboardConfig } from "./config"

describe("getDashboardConfig", () => {
  beforeEach(() => {
    mockGetLocalConfig.mockClear()
  })

  test("returns null when local config is null", () => {
    mockGetLocalConfig.mockReturnValue(null)

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when local config has no dashboard block", () => {
    mockGetLocalConfig.mockReturnValue({
      registries: { "@scope": { type: "gitlab" } },
    })

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns dashboard config when present", () => {
    mockGetLocalConfig.mockReturnValue({
      dashboard: {
        url: "http://127.0.0.1:8090",
        token: "gdk_test-token-123",
      },
    })

    const result = getDashboardConfig("/project")
    expect(result).toEqual({
      url: "http://127.0.0.1:8090",
      token: "gdk_test-token-123",
    })
  })

  test("passes projectRoot to getLocalConfig", () => {
    mockGetLocalConfig.mockReturnValue(null)

    getDashboardConfig("/custom/root")
    expect(mockGetLocalConfig).toHaveBeenCalledWith("/custom/root")
  })

  test("uses process.cwd() as default projectRoot", () => {
    mockGetLocalConfig.mockReturnValue(null)

    getDashboardConfig()
    expect(mockGetLocalConfig).toHaveBeenCalledWith(process.cwd())
  })
})
