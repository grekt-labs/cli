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

import { createMockFetch, jsonResponse, errorResponse } from "#/test-utils"
import { DashboardReporter } from "./reporter"

function createAuthenticatedReporter() {
  let restoreFetch: (() => void) | undefined

  const upsertCalls: Array<{ collection: string; filter: string; data: Record<string, unknown> }> = []

  restoreFetch = createMockFetch(async (url, init) => {
    const urlStr = url as string

    if (urlStr.includes("auth-with-password")) {
      return jsonResponse({ token: "test-token", record: { id: "user1" } })
    }

    const method = init?.method ?? "GET"

    if (method === "POST") {
      const body = JSON.parse(init?.body as string)
      upsertCalls.push({ collection: urlStr.split("/records")[0].split("/").pop()!, filter: "", data: body })
      return jsonResponse({ id: `created-${upsertCalls.length}`, ...body })
    }

    // GET (findRecord) — return empty so upsert creates
    return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
  })

  return { restoreFetch, upsertCalls }
}

describe("DashboardReporter", () => {
  beforeEach(() => {
    mockGetDashboardConfig.mockClear()
    mockWarning.mockClear()
  })

  describe("create", () => {
    test("returns null when config is missing", async () => {
      mockGetDashboardConfig.mockReturnValue(null)

      const reporter = await DashboardReporter.create()
      expect(reporter).toBeNull()
    })

    test("returns null when config is disabled", async () => {
      mockGetDashboardConfig.mockReturnValue({
        enabled: false,
        url: "http://127.0.0.1:8090",
        email: "dev@grekt.com",
        password: "pass",
      })

      const reporter = await DashboardReporter.create()
      expect(reporter).toBeNull()
    })

    test("returns null and warns when authentication fails", async () => {
      mockGetDashboardConfig.mockReturnValue({
        enabled: true,
        url: "http://127.0.0.1:8090",
        email: "bad@grekt.com",
        password: "wrong",
      })

      const restoreFetch = createMockFetch(async () => {
        return errorResponse(400, { message: "Failed to authenticate." })
      })

      const reporter = await DashboardReporter.create()

      expect(reporter).toBeNull()
      expect(mockWarning).toHaveBeenCalledWith("Dashboard: authentication failed")

      restoreFetch()
    })

    test("returns reporter when authentication succeeds", async () => {
      mockGetDashboardConfig.mockReturnValue({
        enabled: true,
        url: "http://127.0.0.1:8090",
        email: "dev@grekt.com",
        password: "devdevdev",
      })

      const restoreFetch = createMockFetch(async () => {
        return jsonResponse({ token: "jwt-token", record: { id: "user1" } })
      })

      const reporter = await DashboardReporter.create()

      expect(reporter).not.toBeNull()
      expect(reporter).toBeInstanceOf(DashboardReporter)

      restoreFetch()
    })
  })

  describe("reportRegistries", () => {
    let restoreFetch: (() => void) | undefined

    beforeEach(() => {
      mockGetDashboardConfig.mockReturnValue({
        enabled: true,
        url: "http://127.0.0.1:8090",
        email: "dev@grekt.com",
        password: "devdevdev",
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

        if (urlStr.includes("auth-with-password")) {
          return jsonResponse({ token: "test-token", record: { id: "user1" } })
        }

        // findRecord returns empty — triggers create
        if (!init?.method || method === "GET") {
          return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
        }

        // createRecord
        return jsonResponse({ id: "reg1", scope: "@company" })
      })

      const reporter = await DashboardReporter.create()
      expect(reporter).not.toBeNull()

      await reporter!.reportRegistries({
        "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
        "@other": { type: "gitlab", host: "gitlab.other.com" },
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

        if (urlStr.includes("auth-with-password")) {
          return jsonResponse({ token: "test-token", record: { id: "user1" } })
        }

        if (!init?.method || method === "GET") {
          return jsonResponse({
            page: 1, perPage: 1, totalPages: 1, totalItems: 1,
            items: [existingRecord],
          })
        }

        return jsonResponse({ id: "existing1", scope: "@company" })
      })

      const reporter = await DashboardReporter.create()
      await reporter!.reportRegistries({
        "@company": { type: "gitlab", host: "gitlab.company.com" },
      })

      const registryRequests = requestLog.filter((r) => r.url.includes("/registries/"))
      const patches = registryRequests.filter((r) => r.method === "PATCH")
      const posts = registryRequests.filter((r) => r.method === "POST")

      expect(patches).toHaveLength(1)
      expect(posts).toHaveLength(0)
    })

    test("handles empty registries without making requests", async () => {
      const requestLog: Array<{ url: string }> = []

      restoreFetch = createMockFetch(async (url) => {
        const urlStr = url as string
        requestLog.push({ url: urlStr })

        if (urlStr.includes("auth-with-password")) {
          return jsonResponse({ token: "test-token", record: { id: "user1" } })
        }

        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const reporter = await DashboardReporter.create()
      await reporter!.reportRegistries({})

      const registryRequests = requestLog.filter((r) => r.url.includes("/registries/"))
      expect(registryRequests).toHaveLength(0)
    })
  })
})
