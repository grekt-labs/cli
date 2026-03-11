import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMockFetch, jsonResponse } from "#/test-utils"

// Mock only fetch (network boundary)
vi.mock("#/context/http", () => ({
  http: {
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
  },
}))

// Suppress UI output during tests
vi.mock("#/shared/ui/ui", () => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  newline: vi.fn(),
  log: vi.fn(),
}))

import { dashboardSyncCommand } from "./sync"

const PROJECT_DIR = join(tmpdir(), `grekt-e2e-dashboard-${crypto.randomUUID()}`)
const originalCwd = process.cwd()

function writeDashboardConfig(registries: Record<string, unknown>) {
  const grektDir = join(PROJECT_DIR, ".grekt")
  mkdirSync(grektDir, { recursive: true })

  const configLines = [
    "dashboard:",
    "  enabled: true",
    "  url: http://127.0.0.1:8090",
    "  email: dev@grekt.com",
    "  password: devdevdev",
    "",
    "registries:",
  ]

  for (const [scope, entry] of Object.entries(registries)) {
    configLines.push(`  "${scope}":`)
    const reg = entry as Record<string, string>
    configLines.push(`    type: ${reg.type}`)
    if (reg.host) configLines.push(`    host: ${reg.host}`)
    if (reg.project) configLines.push(`    project: ${reg.project}`)
  }

  writeFileSync(join(grektDir, "config.yaml"), configLines.join("\n"))
}

describe("grekt dashboard sync registries (e2e)", () => {
  let restoreFetch: (() => void) | undefined

  beforeEach(() => {
    mkdirSync(PROJECT_DIR, { recursive: true })
    process.chdir(PROJECT_DIR)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(PROJECT_DIR, { recursive: true, force: true })
    restoreFetch?.()
    restoreFetch = undefined
  })

  test("full flow: reads config, authenticates, and upserts registries to dashboard", async () => {
    writeDashboardConfig({
      "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
      "@oss": { type: "gitlab", host: "gitlab.com" },
    })

    const requestLog: Array<{ method: string; url: string; body?: unknown }> = []

    restoreFetch = createMockFetch(async (url, init) => {
      const urlStr = url as string
      const method = init?.method ?? "GET"

      requestLog.push({
        method,
        url: urlStr,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      })

      // Auth
      if (urlStr.includes("auth-with-password")) {
        return jsonResponse({ token: "jwt-token", record: { id: "user1" } })
      }

      // findRecord — return empty so upsert creates
      if (!init?.method || method === "GET") {
        return jsonResponse({ page: 1, perPage: 1, totalPages: 0, totalItems: 0, items: [] })
      }

      // createRecord
      const body = JSON.parse(init.body as string)
      return jsonResponse({ id: `reg-${body.scope}`, ...body })
    })

    await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

    // Verify auth happened first
    const authRequest = requestLog.find((r) => r.url.includes("auth-with-password"))
    expect(authRequest).toBeDefined()
    expect(authRequest!.body).toEqual({ identity: "dev@grekt.com", password: "devdevdev" })

    // Verify registry upserts
    const registryCreates = requestLog.filter(
      (r) => r.method === "POST" && r.url.includes("/registries/"),
    )
    expect(registryCreates).toHaveLength(2)

    const scopes = registryCreates.map((r) => (r.body as Record<string, unknown>).scope)
    expect(scopes).toContain("@company")
    expect(scopes).toContain("@oss")

    const companyCreate = registryCreates.find(
      (r) => (r.body as Record<string, unknown>).scope === "@company",
    )
    expect(companyCreate!.body).toMatchObject({
      scope: "@company",
      type: "gitlab",
      host: "gitlab.company.com",
      url: "https://gitlab.company.com",
    })
  })

  test("no registries configured — exits early without contacting dashboard", async () => {
    // Config with dashboard but no registries
    const grektDir = join(PROJECT_DIR, ".grekt")
    mkdirSync(grektDir, { recursive: true })
    writeFileSync(
      join(grektDir, "config.yaml"),
      [
        "dashboard:",
        "  enabled: true",
        "  url: http://127.0.0.1:8090",
        "  email: dev@grekt.com",
        "  password: devdevdev",
      ].join("\n"),
    )

    const requestLog: Array<{ url: string }> = []
    restoreFetch = createMockFetch(async (url) => {
      requestLog.push({ url: url as string })
      return jsonResponse({})
    })

    await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

    // No network calls should have been made
    expect(requestLog).toHaveLength(0)
  })

  test("dashboard disabled — exits early without contacting dashboard", async () => {
    const grektDir = join(PROJECT_DIR, ".grekt")
    mkdirSync(grektDir, { recursive: true })
    writeFileSync(
      join(grektDir, "config.yaml"),
      [
        "dashboard:",
        "  enabled: false",
        "  url: http://127.0.0.1:8090",
        "  email: dev@grekt.com",
        "  password: devdevdev",
        "",
        "registries:",
        '  "@scope":',
        "    type: gitlab",
        "    host: gitlab.com",
      ].join("\n"),
    )

    const requestLog: Array<{ url: string }> = []
    restoreFetch = createMockFetch(async (url) => {
      requestLog.push({ url: url as string })
      return jsonResponse({})
    })

    await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

    // No network calls — dashboard disabled
    expect(requestLog).toHaveLength(0)
  })

  test("auth failure — warns but does not crash", async () => {
    writeDashboardConfig({
      "@scope": { type: "gitlab", host: "gitlab.com" },
    })

    const { warning } = await import("#/shared/ui/ui")

    restoreFetch = createMockFetch(async (url) => {
      const urlStr = url as string
      if (urlStr.includes("auth-with-password")) {
        return new Response(JSON.stringify({ message: "Invalid credentials" }), { status: 400 })
      }
      return jsonResponse({})
    })

    // Should not throw
    await dashboardSyncCommand.parseAsync(["registries"], { from: "user" })

    expect(warning).toHaveBeenCalledWith("Dashboard: authentication failed")
  })
})
