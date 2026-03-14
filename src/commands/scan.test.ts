import { describe, test, expect, vi, beforeEach } from "vitest";
import { parseSource } from "#/registry/sources/sources";
import { formatBadge, severityIcon, truncate, evaluateFailOn, resolveInstalledArtifactDir } from "./scan";
import type { SecurityReport, TrustBadge } from "@grekt/engine";

const { mockLockfileExists, mockGetLockfile, mockFsExists } = vi.hoisted(() => ({
  mockLockfileExists: vi.fn(() => false),
  mockGetLockfile: vi.fn(() => ({ version: 1, artifacts: {} })),
  mockFsExists: vi.fn(() => false),
}));

vi.mock("#/context", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    lockfileExists: mockLockfileExists,
    getLockfile: mockGetLockfile,
    fs: {
      ...(original.fs as Record<string, unknown>),
      exists: mockFsExists,
    },
  };
});

describe("scan", () => {
  describe("source detection", () => {
    test("registry source is detected as remote", () => {
      const source = parseSource("@author/artifact");
      expect(source.type).toBe("registry");
    });

    test("github source is detected as remote", () => {
      const source = parseSource("github:user/repo");
      expect(source.type).toBe("github");
    });

    test("gitlab source is detected as remote", () => {
      const source = parseSource("gitlab:user/repo");
      expect(source.type).toBe("gitlab");
    });

    test("relative path is detected as local", () => {
      const source = parseSource("./local/path");
      expect(source.type).toBe("local");
    });

    test("absolute path is detected as local", () => {
      const source = parseSource("/absolute/path");
      expect(source.type).toBe("local");
    });

    test("home-relative path is detected as local", () => {
      const source = parseSource("~/some/path");
      expect(source.type).toBe("local");
    });

    test("parent-relative path is detected as local", () => {
      const source = parseSource("../parent/path");
      expect(source.type).toBe("local");
    });

    test("dotfile directory path is detected as local", () => {
      const source = parseSource(".claude/skills/api-endpoint/SKILL.md");
      expect(source.type).toBe("local");
    });

    test("dotfile nested path is detected as local", () => {
      const source = parseSource(".grekt/artifacts/some-artifact");
      expect(source.type).toBe("local");
    });

    test("registry source with version is detected", () => {
      const source = parseSource("@author/artifact@1.0.0");
      expect(source.type).toBe("registry");
    });

    test("github source with ref is detected", () => {
      const source = parseSource("github:user/repo#v2.0.0");
      expect(source.type).toBe("github");
      expect(source.ref).toBe("v2.0.0");
    });
  });

  describe("formatBadge", () => {
    test("returns colored text for known badges", () => {
      const result = formatBadge("certified");
      expect(result).toContain("certified");
    });

    test("returns colored text for conditional badge", () => {
      const result = formatBadge("conditional");
      expect(result).toContain("conditional");
    });

    test("returns colored text for suspicious badge", () => {
      const result = formatBadge("suspicious");
      expect(result).toContain("suspicious");
    });

    test("returns colored text for rejected badge", () => {
      const result = formatBadge("rejected");
      expect(result).toContain("rejected");
    });

    test("returns dimmed text for unknown badge", () => {
      const result = formatBadge("unknown");
      expect(result).toContain("unknown");
    });
  });

  describe("severityIcon", () => {
    test("returns warning icon for critical severity", () => {
      const result = severityIcon("critical");
      expect(result).toContain("⚠");
    });

    test("returns warning icon for high severity", () => {
      const result = severityIcon("high");
      expect(result).toContain("⚠");
    });

    test("returns tilde for medium severity", () => {
      const result = severityIcon("medium");
      expect(result).toContain("~");
    });

    test("returns info icon for low severity", () => {
      const result = severityIcon("low");
      expect(result).toContain("i");
    });

    test("returns info icon for info severity", () => {
      const result = severityIcon("info");
      expect(result).toContain("i");
    });

    test("returns bullet for unknown severity", () => {
      const result = severityIcon("other");
      expect(result).toContain("•");
    });
  });

  describe("truncate", () => {
    test("returns text unchanged when shorter than max", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    test("returns text unchanged when equal to max", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    test("truncates and adds ellipsis when longer than max", () => {
      expect(truncate("hello world", 5)).toBe("hello...");
    });

    test("handles empty string", () => {
      expect(truncate("", 5)).toBe("");
    });

    test("truncates at exact position", () => {
      expect(truncate("abcdef", 3)).toBe("abc...");
    });
  });

  describe("evaluateFailOn", () => {
    function makeReport(badge: TrustBadge, score = 80): SecurityReport {
      return {
        score,
        badge,
        findings: [],
        categoryScores: {},
        scannedAt: new Date().toISOString(),
        filesScanned: 1,
      };
    }

    test("returns no failure when all badges are below threshold", () => {
      const results = [
        { artifactId: "@scope/a", report: makeReport("certified") },
        { artifactId: "@scope/b", report: makeReport("conditional") },
      ];
      const result = evaluateFailOn(results, "suspicious");
      expect(result.failed).toBe(false);
      expect(result.failedArtifacts).toHaveLength(0);
    });

    test("returns failure when one badge meets threshold exactly", () => {
      const results = [
        { artifactId: "@scope/a", report: makeReport("suspicious") },
      ];
      const result = evaluateFailOn(results, "suspicious");
      expect(result.failed).toBe(true);
      expect(result.failedArtifacts).toHaveLength(1);
      expect(result.failedArtifacts[0].artifactId).toBe("@scope/a");
    });

    test("returns failure when one badge exceeds threshold", () => {
      const results = [
        { artifactId: "@scope/a", report: makeReport("rejected") },
      ];
      const result = evaluateFailOn(results, "suspicious");
      expect(result.failed).toBe(true);
      expect(result.failedArtifacts[0].badge).toBe("rejected");
    });

    test("excludes trusted artifacts from evaluation", () => {
      const results = [
        { artifactId: "@scope/a", report: makeReport("rejected"), trusted: true },
      ];
      const result = evaluateFailOn(results, "suspicious");
      expect(result.failed).toBe(false);
      expect(result.failedArtifacts).toHaveLength(0);
    });

    test("does not trigger failure for trusted artifact with bad badge", () => {
      const results = [
        { artifactId: "@scope/risky", report: makeReport("rejected"), trusted: true },
        { artifactId: "@scope/safe", report: makeReport("certified") },
      ];
      const result = evaluateFailOn(results, "suspicious");
      expect(result.failed).toBe(false);
    });

    test("evaluates only untrusted artifacts in mixed results", () => {
      const results = [
        { artifactId: "@scope/trusted-bad", report: makeReport("rejected"), trusted: true },
        { artifactId: "@scope/untrusted-bad", report: makeReport("suspicious") },
        { artifactId: "@scope/untrusted-good", report: makeReport("certified") },
      ];
      const result = evaluateFailOn(results, "suspicious");
      expect(result.failed).toBe(true);
      expect(result.failedArtifacts).toHaveLength(1);
      expect(result.failedArtifacts[0].artifactId).toBe("@scope/untrusted-bad");
    });

    test("returns no failure for empty results array", () => {
      const result = evaluateFailOn([], "suspicious");
      expect(result.failed).toBe(false);
      expect(result.failedArtifacts).toHaveLength(0);
    });
  });

  describe("resolveInstalledArtifactDir", () => {
    beforeEach(() => {
      mockLockfileExists.mockClear();
      mockGetLockfile.mockClear();
      mockFsExists.mockClear();
    });

    test("returns undefined when lockfile does not exist", () => {
      mockLockfileExists.mockReturnValue(false);
      const source = parseSource("@scope/artifact");
      const result = resolveInstalledArtifactDir(source, "/project");
      expect(result).toBeUndefined();
      expect(mockGetLockfile).not.toHaveBeenCalled();
    });

    test("returns undefined when artifact is not in lockfile", () => {
      mockLockfileExists.mockReturnValue(true);
      mockGetLockfile.mockReturnValue({ version: 1, artifacts: {} });
      const source = parseSource("@scope/artifact");
      const result = resolveInstalledArtifactDir(source, "/project");
      expect(result).toBeUndefined();
    });

    test("returns undefined when artifact is in lockfile but directory is missing", () => {
      mockLockfileExists.mockReturnValue(true);
      mockGetLockfile.mockReturnValue({
        version: 1,
        artifacts: { "@scope/artifact": { source: "@scope/artifact", resolved: "https://example.com", integrity: "sha256-abc" } },
      });
      mockFsExists.mockReturnValue(false);
      const source = parseSource("@scope/artifact");
      const result = resolveInstalledArtifactDir(source, "/project");
      expect(result).toBeUndefined();
    });

    test("returns local directory path when artifact is installed", () => {
      mockLockfileExists.mockReturnValue(true);
      mockGetLockfile.mockReturnValue({
        version: 1,
        artifacts: { "@scope/artifact": { source: "@scope/artifact", resolved: "https://example.com", integrity: "sha256-abc" } },
      });
      mockFsExists.mockReturnValue(true);
      const source = parseSource("@scope/artifact");
      const result = resolveInstalledArtifactDir(source, "/project");
      expect(result).toBe("/project/.grekt/artifacts/@scope/artifact");
    });

    test("returns undefined for github source not in lockfile", () => {
      mockLockfileExists.mockReturnValue(true);
      mockGetLockfile.mockReturnValue({ version: 1, artifacts: {} });
      const source = parseSource("github:user/repo");
      const result = resolveInstalledArtifactDir(source, "/project");
      expect(result).toBeUndefined();
    });

    test("returns local directory for github source when installed", () => {
      mockLockfileExists.mockReturnValue(true);
      mockGetLockfile.mockReturnValue({
        version: 1,
        artifacts: { "github:user/repo": { source: "github:user/repo", resolved: "https://github.com/user/repo", integrity: "sha256-abc" } },
      });
      mockFsExists.mockReturnValue(true);
      const source = parseSource("github:user/repo");
      const result = resolveInstalledArtifactDir(source, "/project");
      expect(result).toBe("/project/.grekt/artifacts/github:user/repo");
    });
  });
});
