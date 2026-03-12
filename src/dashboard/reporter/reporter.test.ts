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

import type { SecurityReport } from "@grekt/engine"
import { createMockFetch, jsonResponse } from "#/test-utils"
import { DashboardReporter } from "./reporter"

function makeScanReport(overrides: Partial<SecurityReport> = {}): SecurityReport {
  return {
    score: 85,
    badge: "conditional",
    findings: [],
    categoryScores: { permissions: 90, secrets: 80 },
    scannedAt: "2026-03-12T00:00:00.000Z",
    filesScanned: 10,
    ...overrides,
  }
}

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

    test("returns synced count", async () => {
      restoreFetch = createMockFetch(async (_url, init) => {
        if (!init?.method || init.method === "GET") {
          return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
        }
        return jsonResponse({ id: "reg1", scope: "@a" })
      })

      const reporter = DashboardReporter.create()
      const count = await reporter!.reportRegistries({
        "@a": { type: "gitlab", host: "gitlab.com", project: "group/a" },
        "@b": { type: "gitlab", host: "gitlab.com", project: "group/b" },
        "@no-project": { type: "gitlab", host: "gitlab.com" },
      })

      expect(count).toBe(2)
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

  describe("reportScan", () => {
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

    test("creates scan_run and scan_results for each artifact", async () => {
      const requestLog: Array<{ method: string; url: string; body?: unknown }> = []
      const projectRecord = { id: "proj1", collectionName: "projects", name: "test-project" }
      const artifactRecord = { id: "pa1", collectionName: "project_artifacts", artifact_id: "@scope/art" }

      restoreFetch = createMockFetch(async (url, init) => {
        const urlStr = url as string
        const method = init?.method ?? "GET"
        requestLog.push({
          method,
          url: urlStr,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        })

        if (!init?.method || method === "GET") {
          if (urlStr.includes("/projects/")) {
            return jsonResponse({ page: 1, perPage: 1, totalPages: 1, totalItems: 1, items: [projectRecord] })
          }
          if (urlStr.includes("/project_artifacts/")) {
            return jsonResponse({ page: 1, perPage: 1, totalPages: 1, totalItems: 1, items: [artifactRecord] })
          }
          return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
        }

        if (urlStr.includes("/scan_runs/")) {
          return jsonResponse({ id: "sr1" })
        }
        return jsonResponse({ id: "sres1" })
      })

      const reporter = DashboardReporter.create()
      await reporter!.reportScan("test-project", [
        { artifactId: "@scope/art", report: makeScanReport(), trusted: false },
      ], "cli")

      const scanRunPosts = requestLog.filter((r) => r.method === "POST" && r.url.includes("/scan_runs/"))
      expect(scanRunPosts).toHaveLength(1)
      expect(scanRunPosts[0].body).toMatchObject({
        project: "proj1",
        triggered_by: "cli",
        total_artifacts: 1,
        total_findings: 0,
      })

      const scanResultPosts = requestLog.filter((r) => r.method === "POST" && r.url.includes("/scan_results/"))
      expect(scanResultPosts).toHaveLength(1)
      expect(scanResultPosts[0].body).toMatchObject({
        scan_run: "sr1",
        project_artifact: "pa1",
        score: 85,
        badge: "conditional",
        trusted: false,
      })
    })

    test("warns and skips when project not found", async () => {
      restoreFetch = createMockFetch(async () => {
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      })

      const reporter = DashboardReporter.create()
      await reporter!.reportScan("unknown-project", [
        { artifactId: "@scope/art", report: makeScanReport() },
      ], "cli")

      expect(mockWarning).toHaveBeenCalledWith(
        'Dashboard: project "unknown-project" not found, skipping scan report',
      )
    })

    test("skips artifacts without project_artifact record", async () => {
      const projectRecord = { id: "proj1", collectionName: "projects", name: "test-project" }
      const requestLog: Array<{ method: string; url: string }> = []

      restoreFetch = createMockFetch(async (url, init) => {
        const urlStr = url as string
        const method = init?.method ?? "GET"
        requestLog.push({ method, url: urlStr })

        if (!init?.method || method === "GET") {
          if (urlStr.includes("/projects/")) {
            return jsonResponse({ page: 1, perPage: 1, totalPages: 1, totalItems: 1, items: [projectRecord] })
          }
          // project_artifacts not found
          return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
        }

        if (urlStr.includes("/scan_runs/")) {
          return jsonResponse({ id: "sr1" })
        }
        return jsonResponse({ id: "sres1" })
      })

      const reporter = DashboardReporter.create()
      await reporter!.reportScan("test-project", [
        { artifactId: "@scope/missing", report: makeScanReport() },
      ], "cli")

      const scanResultPosts = requestLog.filter((r) => r.method === "POST" && r.url.includes("/scan_results/"))
      expect(scanResultPosts).toHaveLength(0)
    })

    test("counts total findings across all results", async () => {
      const projectRecord = { id: "proj1", collectionName: "projects", name: "test-project" }
      const requestLog: Array<{ method: string; url: string; body?: unknown }> = []

      restoreFetch = createMockFetch(async (url, init) => {
        const urlStr = url as string
        const method = init?.method ?? "GET"
        requestLog.push({
          method,
          url: urlStr,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        })

        if (!init?.method || method === "GET") {
          if (urlStr.includes("/projects/")) {
            return jsonResponse({ page: 1, perPage: 1, totalPages: 1, totalItems: 1, items: [projectRecord] })
          }
          return jsonResponse({ page: 1, perPage: 1, totalPages: 1, totalItems: 1, items: [{ id: "pa1" }] })
        }

        return jsonResponse({ id: "new1" })
      })

      const reportWithFindings = makeScanReport({
        findings: [
          { id: "F1", category: "secrets", severity: "high", title: "Secret found", description: "", evidence: "key=abc", deduction: 20, recommendation: "Remove" },
          { id: "F2", category: "permissions", severity: "medium", title: "Wide perms", description: "", evidence: "*", deduction: 10, recommendation: "Restrict" },
        ],
      })

      const reporter = DashboardReporter.create()
      await reporter!.reportScan("test-project", [
        { artifactId: "@scope/a", report: reportWithFindings },
        { artifactId: "@scope/b", report: makeScanReport() },
      ], "cli")

      const scanRunPost = requestLog.find((r) => r.method === "POST" && r.url.includes("/scan_runs/"))
      expect((scanRunPost?.body as Record<string, unknown>).total_findings).toBe(2)
    })
  })
})
