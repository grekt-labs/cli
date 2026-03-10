import { describe, test, expect, vi, beforeEach } from "vitest"

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    exists: vi.fn(() => false),
    readFile: vi.fn(() => ""),
  },
}))

vi.mock("#/context", () => ({
  fs: mockFs,
}))

import { getDashboardConfig } from "./config"

describe("getDashboardConfig", () => {
  beforeEach(() => {
    mockFs.exists.mockClear()
    mockFs.readFile.mockClear()
  })

  test("returns null when no config file exists", () => {
    mockFs.exists.mockReturnValue(false)

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when config file is empty", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue("   ")

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when YAML is invalid", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue("not: [valid: yaml")

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when dashboard key is missing", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue("registries:\n  '@scope':\n    type: gitlab\n")

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when dashboard block has invalid url", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      "  enabled: true",
      "  url: not-a-url",
      "  email: dev@grekt.com",
      "  password: devdevdev",
    ].join("\n"))

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when dashboard block has invalid email", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      "  enabled: true",
      "  url: http://127.0.0.1:8090",
      "  email: not-an-email",
      "  password: devdevdev",
    ].join("\n"))

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when dashboard block is missing required fields", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      "  enabled: true",
    ].join("\n"))

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns null when password is empty string", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      '  enabled: true',
      '  url: http://127.0.0.1:8090',
      '  email: dev@grekt.com',
      '  password: ""',
    ].join("\n"))

    const result = getDashboardConfig("/project")
    expect(result).toBeNull()
  })

  test("returns config when dashboard block is valid", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      "  enabled: true",
      "  url: http://127.0.0.1:8090",
      "  email: dev@grekt.com",
      "  password: devdevdev",
    ].join("\n"))

    const result = getDashboardConfig("/project")
    expect(result).toEqual({
      enabled: true,
      url: "http://127.0.0.1:8090",
      email: "dev@grekt.com",
      password: "devdevdev",
    })
  })

  test("returns config with enabled false when explicitly disabled", () => {
    mockFs.exists.mockReturnValue(true)
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      "  enabled: false",
      "  url: http://127.0.0.1:8090",
      "  email: dev@grekt.com",
      "  password: devdevdev",
    ].join("\n"))

    const result = getDashboardConfig("/project")
    expect(result).toEqual({
      enabled: false,
      url: "http://127.0.0.1:8090",
      email: "dev@grekt.com",
      password: "devdevdev",
    })
  })

  test("walks up directory tree to find config", () => {
    mockFs.exists.mockImplementation((path: string) => {
      return path === "/project/.grekt/config.yaml"
    })
    mockFs.readFile.mockReturnValue([
      "dashboard:",
      "  enabled: true",
      "  url: http://127.0.0.1:8090",
      "  email: dev@grekt.com",
      "  password: devdevdev",
    ].join("\n"))

    const result = getDashboardConfig("/project/packages/cli")
    expect(result).not.toBeNull()
    expect(result!.enabled).toBe(true)
  })
})
