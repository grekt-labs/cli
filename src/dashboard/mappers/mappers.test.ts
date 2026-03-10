import { describe, test, expect } from "vitest"
import type { LockfileEntry, EvalSummary, EvalElementResult, ArtifactInfo } from "@grekt/engine"
import {
  mapProjectToRecord,
  mapArtifactToRecord,
  mapElementsToRecords,
  mapEvalRunToRecord,
  mapEvalResultToRecord,
  mapRegistryToRecord,
} from "./mappers"

describe("mapProjectToRecord", () => {
  test("uses config name when available", () => {
    const config = { name: "my-project", targets: ["claude"], artifacts: {}, customTargets: {}, remoteSearch: false }
    const result = mapProjectToRecord(config, "/home/user/my-project")

    expect(result.name).toBe("my-project")
  })

  test("falls back to directory name when config name is missing", () => {
    const config = { targets: ["claude"], artifacts: {}, customTargets: {}, remoteSearch: false }
    const result = mapProjectToRecord(config, "/home/user/my-project")

    expect(result.name).toBe("my-project")
  })

  test("maps all fields correctly", () => {
    const config = {
      name: "test",
      description: "A test project",
      targets: ["claude", "cursor"],
      registry: "https://registry.grekt.com",
      repository: "https://github.com/test/repo",
      artifacts: {},
      customTargets: {},
      remoteSearch: false,
    }

    const result = mapProjectToRecord(config, "/project")

    expect(result).toEqual({
      name: "test",
      description: "A test project",
      targets: ["claude", "cursor"],
      default_registry: "https://registry.grekt.com",
      repository: "https://github.com/test/repo",
    })
  })

  test("defaults optional fields to empty strings", () => {
    const config = { targets: [], artifacts: {}, customTargets: {}, remoteSearch: false }
    const result = mapProjectToRecord(config, "/project")

    expect(result.description).toBe("")
    expect(result.default_registry).toBe("")
    expect(result.repository).toBe("")
  })
})

describe("mapArtifactToRecord", () => {
  const baseLockEntry: LockfileEntry = {
    version: "1.0.0",
    integrity: "sha256-abc",
    source: "registry",
    resolved: "https://registry.grekt.com/@scope/tool",
    mode: "lazy",
    files: {},
  }

  test("maps basic fields correctly", () => {
    const result = mapArtifactToRecord("@scope/tool", baseLockEntry, null, "proj1")

    expect(result.project).toBe("proj1")
    expect(result.artifact_id).toBe("@scope/tool")
    expect(result.version).toBe("1.0.0")
    expect(result.mode).toBe("lazy")
  })

  test("extracts scope from scoped artifact id", () => {
    const result = mapArtifactToRecord("@grekt/code-reviewer", baseLockEntry, null, "proj1")
    expect(result.registry_scope).toBe("@grekt")
  })

  test("returns empty scope for unscoped artifact", () => {
    const result = mapArtifactToRecord("my-tool", baseLockEntry, null, "proj1")
    expect(result.registry_scope).toBe("")
  })

  test("counts elements from artifact info", () => {
    const info = {
      manifest: { name: "tool", version: "1.0.0", description: "test" },
      skills: [{ path: "s1.md", parsed: { frontmatter: {}, content: "" } }],
      agents: [{ path: "a1.md", parsed: { frontmatter: {}, content: "" } }],
      commands: [],
      mcps: [],
      rules: [],
      hooks: [],
      invalidFiles: [],
    } as unknown as ArtifactInfo

    const result = mapArtifactToRecord("tool", baseLockEntry, info, "proj1")
    expect(result.element_count).toBe(2)
  })

  test("returns zero element count when artifact info is null", () => {
    const result = mapArtifactToRecord("tool", baseLockEntry, null, "proj1")
    expect(result.element_count).toBe(0)
  })

  test("uses artifact id as fallback name when info is null", () => {
    const result = mapArtifactToRecord("@scope/tool", baseLockEntry, null, "proj1")
    expect(result.name).toBe("@scope/tool")
  })

  test("uses resolved URL from lock entry", () => {
    const result = mapArtifactToRecord("tool", baseLockEntry, null, "proj1")
    expect(result.registry_url).toBe("https://registry.grekt.com/@scope/tool")
  })

  test("defaults registry url to empty when resolved is undefined", () => {
    const entry = { ...baseLockEntry, resolved: undefined }
    const result = mapArtifactToRecord("tool", entry, null, "proj1")
    expect(result.registry_url).toBe("")
  })
})

describe("mapElementsToRecords", () => {
  test("returns empty array for artifact with no elements", () => {
    const info = {
      manifest: { name: "empty", version: "1.0.0", description: "" },
      skills: [],
      agents: [],
      commands: [],
      mcps: [],
      rules: [],
      hooks: [],
      invalidFiles: [],
    } as unknown as ArtifactInfo

    const result = mapElementsToRecords(info, "pa1")
    expect(result).toEqual([])
  })

  test("maps elements from all categories", () => {
    const info = {
      manifest: { name: "multi", version: "1.0.0", description: "" },
      skills: [{ path: "skills/review.md", parsed: { frontmatter: { "grk-name": "review" }, content: "" } }],
      agents: [{ path: "agents/coder.md", parsed: { frontmatter: { "grk-name": "coder" }, content: "" } }],
      commands: [],
      mcps: [],
      rules: [{ path: "rules/style.md", parsed: { frontmatter: {}, content: "" } }],
      hooks: [],
      invalidFiles: [],
    } as unknown as ArtifactInfo

    const result = mapElementsToRecords(info, "pa1")
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      project_artifact: "pa1",
      name: "review",
      type: "skills",
      has_eval: false,
    })
    expect(result[1]).toEqual({
      project_artifact: "pa1",
      name: "coder",
      type: "agents",
      has_eval: false,
    })
  })

  test("falls back to file path when grk-name is missing", () => {
    const info = {
      manifest: { name: "test", version: "1.0.0", description: "" },
      skills: [{ path: "skills/unnamed.md", parsed: { frontmatter: {}, content: "" } }],
      agents: [],
      commands: [],
      mcps: [],
      rules: [],
      hooks: [],
      invalidFiles: [],
    } as unknown as ArtifactInfo

    const result = mapElementsToRecords(info, "pa1")
    expect(result[0].name).toBe("skills/unnamed.md")
  })
})

describe("mapEvalRunToRecord", () => {
  const baseSummary: EvalSummary = {
    results: [],
    overallScore: 85,
    overallGrade: "B",
    totalPassed: 17,
    totalTests: 20,
    totalIssues: 3,
  }

  test("maps all fields correctly", () => {
    const result = mapEvalRunToRecord(baseSummary, "proj1", "cli")

    expect(result).toEqual({
      project: "proj1",
      triggered_by: "cli",
      overall_score: 85,
      overall_grade: "B",
      total_passed: 17,
      total_tests: 20,
      total_issues: 3,
    })
  })

  test("maps ci triggered_by", () => {
    const result = mapEvalRunToRecord(baseSummary, "proj1", "ci")
    expect(result.triggered_by).toBe("ci")
  })
})

describe("mapEvalResultToRecord", () => {
  test("maps all fields including failures", () => {
    const evalResult: EvalElementResult = {
      artifactId: "@scope/tool",
      elementName: "review",
      elementType: "skills",
      passed: 4,
      total: 5,
      score: 80,
      grade: "B",
      failures: [{ testName: "edge-case", expected: "x", actual: "y", message: "mismatch" }] as EvalElementResult["failures"],
    }

    const result = mapEvalResultToRecord(evalResult, "run1", "pa1")

    expect(result).toEqual({
      eval_run: "run1",
      project_artifact: "pa1",
      element_name: "review",
      element_type: "skills",
      passed: 4,
      total: 5,
      score: 80,
      grade: "B",
      failures: evalResult.failures,
    })
  })
})

describe("mapRegistryToRecord", () => {
  test("maps gitlab registry", () => {
    const result = mapRegistryToRecord("@company", {
      type: "gitlab",
      host: "gitlab.company.com",
      project: "group/artifacts",
    })

    expect(result).toEqual({
      scope: "@company",
      name: "@company",
      type: "gitlab",
      host: "gitlab.company.com",
      url: "https://gitlab.company.com",
      artifact_count: 0,
    })
  })

  test("defaults host and url to empty strings", () => {
    const result = mapRegistryToRecord("@default", { type: "default" })

    expect(result.host).toBe("")
    expect(result.url).toBe("")
  })
})
