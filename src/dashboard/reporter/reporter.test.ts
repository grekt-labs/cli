import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"

const { mockGetDashboardConfig } = vi.hoisted(() => ({
  mockGetDashboardConfig: vi.fn(),
}))

vi.mock("#/dashboard/config/config", () => ({
  getDashboardConfig: mockGetDashboardConfig,
}))

const { mockWarning } = vi.hoisted(() => ({
  mockWarning: vi.fn(),
}))

vi.mock("#/shared/ui/ui", () => ({
  warning: mockWarning,
}))

vi.mock("#/context/http", () => ({
  http: {
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
  },
}))

vi.mock("#/context", () => ({
  scanArtifact: vi.fn(() => null),
}))

import { createMockFetch, jsonResponse } from "#/test-utils"
import { DashboardReporter } from "./reporter"

describe("DashboardReporter", () => {
  beforeEach(() => {
    mockGetDashboardConfig.mockClear()
    mockWarning.mockClear()
  })

  describe("create", () => {
    test("returns null when config is missing", () => {
      mockGetDashboardConfig.mockReturnValue(null)

      const reporter = DashboardReporter.create()
      expect(reporter).toBeNull()
    })

    test("returns reporter when config is valid", () => {
      mockGetDashboardConfig.mockReturnValue({
        url: "http://127.0.0.1:8090",
        token: "gdk_test-token",
      })

      const reporter = DashboardReporter.create()
      expect(reporter).not.toBeNull()
      expect(reporter).toBeInstanceOf(DashboardReporter)
    })
  })

  describe("reportRegistries", () => {
    let restoreFetch: (() => void) | undefined

    beforeEach(() => {
      mockGetDashboardConfig.mockReturnValue({
        url: "http://127.0.0.1:8090",
        token: "gdk_test-token",
      })
    })

    afterEach(() => {
      restoreFetch?.()
      restoreFetch = undefined
    })

    test("upserts each registry scope", async () => {
      const requestLog: Array<{ method: string; url: string; body?: unknown }> = []

      restoreFetch = createMockFetch(async (url, init) => {
        const urlStr = url as string
        const method = init?.method ?? "GET"

        requestLog.push({
          method,
          url: urlStr,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        })

        // findRecord returns empty — triggers create
        if (!init?.method || method === "GET") {
          return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
        }

        // createRecord
        return jsonResponse({ id: "reg1", scope: "@company" })
      })

      const reporter = DashboardReporter.create()
      expect(reporter).not.toBeNull()

      await reporter!.reportRegistries({
        "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
        "@other": { type: "gitlab", host: "gitlab.other.com", project: "team/artifacts" },
      })

      const registryRequests = requestLog.filter((r) => r.url.includes("/registries/"))
      // 2 scopes × (1 find + 1 create) = 4 requests
      expect(registryRequests.length).toBe(4)

      const creates = registryRequests.filter((r) => r.method === "POST")
      expect(creates).toHaveLength(2)
      expect(creates[0].body).toMatchObject({ scope: "@company", type: "gitlab" })
      expect(creates[1].body).toMatchObject({ scope: "@other", type: "gitlab" })
    })

    test("updates existing registry instead of creating", async () => {
      const existingRecord = { id: "existing1", collectionName: "registries", scope: "@company" }
      const requestLog: Array<{ method: string; url: string }> = []

      restoreFetch = createMockFetch(async (url, init) => {
        const urlStr = url as string
        const method = init?.method ?? "GET"
        requestLog.push({ method, url: urlStr })

        if (!init?.method || method === "GET") {
          return jsonResponse({
            page: 1, perPage: 1, totalPages: 1, totalItems: 1,
            items: [existingRecord],
          })
        }

        return jsonResponse({ id: "existing1", scope: "@company" })
      })

      const reporter = DashboardReporter.create()
      await reporter!.reportRegistries({
        "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
      })

      const registryRequests = requestLog.filter((r) => r.url.includes("/registries/"))
      const patches = registryRequests.filter((r) => r.method === "PATCH")
      const posts = registryRequests.filter((r) => r.method === "POST")

      expect(patches).toHaveLength(1)
      expect(posts).toHaveLength(0)
    })

    test("skips registries without project and warns", async () => {
      restoreFetch = createMockFetch(async () => {
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const reporter = DashboardReporter.create()
      const count = await reporter!.reportRegistries({
        "@no-project": { type: "gitlab", host: "gitlab.com" },
      })

      expect(count).toBe(0)
      expect(mockWarning).toHaveBeenCalledWith(
        'Registry "@no-project" has no project configured, skipping sync.',
      )
    })

    test("handles empty registries without making requests", async () => {
      const requestLog: Array<{ url: string }> = []

      restoreFetch = createMockFetch(async (url) => {
        requestLog.push({ url: url as string })
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const reporter = DashboardReporter.create()
      await reporter!.reportRegistries({})

      expect(requestLog).toHaveLength(0)
    })
  })
})
