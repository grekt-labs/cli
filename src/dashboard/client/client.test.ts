import { describe, test, expect, vi, afterEach } from "vitest"
import { createMockFetch, jsonResponse, errorResponse } from "#/test-utils"

vi.mock("#/context/http", () => ({
  http: {
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
  },
}))

import { DashboardClient } from "./client"

describe("DashboardClient", () => {
  let restoreFetch: (() => void) | undefined

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = undefined
  })

  describe("findRecord", () => {
    test("returns null when no records match", async () => {
      restoreFetch = createMockFetch(async () => {
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      const result = await client.findRecord("projects", 'name = "test"')
      expect(result).toBeNull()
    })

    test("returns first record when match exists", async () => {
      const record = { id: "rec1", collectionName: "projects", name: "test" }

      restoreFetch = createMockFetch(async () => {
        return jsonResponse({ page: 1, perPage: 1, totalPages: 1, totalItems: 1, items: [record] })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      const result = await client.findRecord("projects", 'name = "test"')
      expect(result).toEqual(record)
    })

    test("encodes filter in query params", async () => {
      let capturedUrl: string | undefined

      restoreFetch = createMockFetch(async (url) => {
        capturedUrl = url as string
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      await client.findRecord("projects", 'name = "test project"')

      expect(capturedUrl).toContain("filter=")
      expect(capturedUrl).toContain("perPage=1")
    })

    test("throws when server returns error", async () => {
      restoreFetch = createMockFetch(async () => {
        return errorResponse(500, { message: "Internal error" })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      await expect(client.findRecord("projects", 'name = "x"')).rejects.toThrow("PocketBase 500")
    })
  })

  describe("createRecord", () => {
    test("sends POST with data and returns created record", async () => {
      let capturedMethod: string | undefined
      let capturedBody: string | undefined
      const created = { id: "new1", collectionName: "projects", name: "my-project" }

      restoreFetch = createMockFetch(async (_url, init) => {
        capturedMethod = init?.method
        capturedBody = init?.body as string
        return jsonResponse(created)
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      const result = await client.createRecord("projects", { name: "my-project" })

      expect(capturedMethod).toBe("POST")
      expect(JSON.parse(capturedBody!)).toEqual({ name: "my-project" })
      expect(result).toEqual(created)
    })

    test("throws on 400 validation error", async () => {
      restoreFetch = createMockFetch(async () => {
        return errorResponse(400, { message: "Validation failed" })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      await expect(client.createRecord("projects", {})).rejects.toThrow("PocketBase 400")
    })
  })

  describe("updateRecord", () => {
    test("sends PATCH with data to correct URL", async () => {
      let capturedUrl: string | undefined
      let capturedMethod: string | undefined

      restoreFetch = createMockFetch(async (url, init) => {
        capturedUrl = url as string
        capturedMethod = init?.method
        return jsonResponse({ id: "rec1", name: "updated" })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      await client.updateRecord("projects", "rec1", { name: "updated" })

      expect(capturedUrl).toContain("/api/collections/projects/records/rec1")
      expect(capturedMethod).toBe("PATCH")
    })
  })

  describe("upsertByFilter", () => {
    test("creates record when none exists", async () => {
      const calls: Array<{ method: string; url: string }> = []

      restoreFetch = createMockFetch(async (url, init) => {
        const method = init?.method ?? "GET"
        calls.push({ method, url: url as string })

        if (method === "GET" || !init?.method) {
          return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
        }
        return jsonResponse({ id: "new1", name: "test" })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      const result = await client.upsertByFilter("projects", 'name = "test"', { name: "test" })

      expect(result.id).toBe("new1")
      expect(calls.some((c) => c.method === "POST")).toBe(true)
    })

    test("updates record when one exists", async () => {
      const existingRecord = { id: "existing1", collectionName: "projects", name: "old" }
      const calls: Array<{ method: string; url: string }> = []

      restoreFetch = createMockFetch(async (url, init) => {
        const method = init?.method ?? "GET"
        calls.push({ method, url: url as string })

        if (method === "GET" || !init?.method) {
          return jsonResponse({
            page: 1, perPage: 1, totalPages: 1, totalItems: 1,
            items: [existingRecord],
          })
        }
        return jsonResponse({ id: "existing1", name: "updated" })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_test-token")
      const result = await client.upsertByFilter("projects", 'name = "old"', { name: "updated" })

      expect(result.id).toBe("existing1")
      expect(calls.some((c) => c.method === "PATCH")).toBe(true)
      expect(calls.every((c) => c.method !== "POST")).toBe(true)
    })
  })

  describe("auth header", () => {
    test("includes token in all requests", async () => {
      let requestHeaders: Record<string, string> = {}

      restoreFetch = createMockFetch(async (_url, init) => {
        requestHeaders = (init?.headers ?? {}) as Record<string, string>
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const client = new DashboardClient("http://127.0.0.1:8090", "gdk_my-token")
      await client.findRecord("projects", 'name = "x"')

      expect(requestHeaders["Authorization"]).toBe("Bearer gdk_my-token")
    })
  })

  describe("base URL handling", () => {
    test("strips trailing slash from base URL", async () => {
      let capturedUrl: string | undefined

      restoreFetch = createMockFetch(async (url) => {
        capturedUrl = url as string
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const client = new DashboardClient("http://127.0.0.1:8090/", "gdk_test-token")
      await client.findRecord("projects", 'name = "x"')

      expect(capturedUrl).toContain("http://127.0.0.1:8090/api/")
      expect(capturedUrl).not.toContain("http://127.0.0.1:8090//api/")
    })
  })
})
