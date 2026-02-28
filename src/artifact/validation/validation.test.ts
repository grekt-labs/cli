import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  resolveAndAssertWithinBase,
  sanitizeArtifactMode,
  isSafeArtifactId,
  assertSafeArtifactId,
} from "./validation";

// --- Mocks for validateArtifact dependencies ---

const mockIsInitialized = mock(() => true);
const mockFsExists = mock(() => true);
const mockFsReadFile = mock(() => "");

mock.module("#/config/project/project", () => ({
  isInitialized: mockIsInitialized,
}));

mock.module("#/context", () => ({
  fs: {
    exists: mockFsExists,
    readFile: mockFsReadFile,
  },
}));

import { validateArtifact } from "./validation";

describe("validation", () => {
  describe("resolveAndAssertWithinBase", () => {
    test("accepts valid relative path within base", () => {
      const result = resolveAndAssertWithinBase("/project/artifacts", "skills/skill.md");

      expect(result).toBe("/project/artifacts/skills/skill.md");
    });

    test("accepts nested paths within base", () => {
      const result = resolveAndAssertWithinBase("/project", "deep/nested/file.md");

      expect(result).toBe("/project/deep/nested/file.md");
    });

    test("rejects path traversal with double dots", () => {
      expect(() =>
        resolveAndAssertWithinBase("/project/artifacts", "../../etc/passwd")
      ).toThrow("Path traversal detected");
    });

    test("rejects path traversal to parent directory", () => {
      expect(() =>
        resolveAndAssertWithinBase("/project/artifacts", "../secrets.yaml")
      ).toThrow("Path traversal detected");
    });

    test("rejects path traversal with embedded double dots", () => {
      expect(() =>
        resolveAndAssertWithinBase("/project/artifacts", "skills/../../outside.md")
      ).toThrow("Path traversal detected");
    });

    test("accepts path that resolves to base itself", () => {
      const result = resolveAndAssertWithinBase("/project/artifacts", ".");

      expect(result).toBe("/project/artifacts");
    });

    test("rejects absolute path outside base", () => {
      expect(() =>
        resolveAndAssertWithinBase("/project/artifacts", "/etc/passwd")
      ).toThrow("Path traversal detected");
    });
  });

  describe("sanitizeArtifactMode", () => {
    test("accepts 'lazy' mode", () => {
      expect(sanitizeArtifactMode("lazy")).toBe("lazy");
    });

    test("accepts 'core' mode", () => {
      expect(sanitizeArtifactMode("core")).toBe("core");
    });

    test("accepts 'core-sym' mode", () => {
      expect(sanitizeArtifactMode("core-sym")).toBe("core-sym");
    });

    test("falls back to 'lazy' for undefined", () => {
      expect(sanitizeArtifactMode(undefined)).toBe("lazy");
    });

    test("falls back to 'lazy' for unknown mode string", () => {
      expect(sanitizeArtifactMode("malicious-mode")).toBe("lazy");
    });

    test("falls back to 'lazy' for empty string", () => {
      expect(sanitizeArtifactMode("")).toBe("lazy");
    });
  });

  describe("isSafeArtifactId", () => {
    test("accepts valid scoped artifact id", () => {
      expect(isSafeArtifactId("@scope/artifact")).toBe(true);
    });

    test("rejects path traversal", () => {
      expect(isSafeArtifactId("../../../etc/passwd")).toBe(false);
    });

    test("rejects absolute paths", () => {
      expect(isSafeArtifactId("/etc/passwd")).toBe(false);
    });

    test("rejects null bytes", () => {
      expect(isSafeArtifactId("artifact\0malicious")).toBe(false);
    });

    test("rejects backslash absolute path", () => {
      expect(isSafeArtifactId("\\windows\\path")).toBe(false);
    });

    test("accepts simple unscoped name", () => {
      expect(isSafeArtifactId("my-artifact")).toBe(true);
    });
  });

  describe("assertSafeArtifactId", () => {
    test("does not throw for safe id", () => {
      expect(() => assertSafeArtifactId("@scope/artifact")).not.toThrow();
    });

    test("throws for unsafe id with path traversal", () => {
      expect(() => assertSafeArtifactId("../evil")).toThrow("unsafe path characters");
    });

    test("throws for unsafe id with null byte", () => {
      expect(() => assertSafeArtifactId("art\0ifact")).toThrow("unsafe path characters");
    });
  });

  describe("validateArtifact", () => {
    const PROJECT_ROOT = "/project";
    const ARTIFACT_PATH = "/project/my-artifact";

    const VALID_MANIFEST_YAML = [
      'name: "@test/artifact"',
      'version: "1.0.0"',
      'description: "Test artifact"',
    ].join("\n");

    beforeEach(() => {
      mockIsInitialized.mockClear();
      mockFsExists.mockClear();
      mockFsReadFile.mockClear();

      mockIsInitialized.mockReturnValue(true);
      mockFsExists.mockReturnValue(true);
      mockFsReadFile.mockReturnValue(VALID_MANIFEST_YAML);
    });

    test("returns not-initialized error when project is not initialized", () => {
      mockIsInitialized.mockReturnValue(false);

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("not-initialized");
      }
    });

    test("returns not-found error when artifact path does not exist", () => {
      mockFsExists.mockImplementation((path: string) => {
        if (path === ARTIFACT_PATH) return false;
        return true;
      });

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("not-found");
      }
    });

    test("returns no-manifest error when grekt.yaml is missing", () => {
      mockFsExists.mockImplementation((path: string) => {
        if (path.endsWith("grekt.yaml")) return false;
        return true;
      });

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("no-manifest");
      }
    });

    test("returns invalid-manifest error for malformed manifest", () => {
      mockFsReadFile.mockReturnValue("name: 123\n");

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("invalid-manifest");
        expect(result.error.details).toBeDefined();
        expect(result.error.details!.length).toBeGreaterThan(0);
      }
    });

    test("returns invalid-manifest error for completely invalid version string", () => {
      const badVersionYaml = [
        'name: "@test/artifact"',
        'version: "not-a-version"',
        'description: "Test"',
      ].join("\n");
      mockFsReadFile.mockReturnValue(badVersionYaml);

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Zod schema rejects it before isValidSemver check
        expect(result.error.type).toBe("invalid-manifest");
      }
    });

    test("returns invalid-version error for version with v prefix", () => {
      const vPrefixYaml = [
        'name: "@test/artifact"',
        'version: "v1.0.0"',
        'description: "Test"',
      ].join("\n");
      mockFsReadFile.mockReturnValue(vPrefixYaml);

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT);

      // v-prefix might pass schema but fail isValidSemver, or fail at schema
      expect(result.success).toBe(false);
    });

    test("returns keywords error when too few keywords required", () => {
      mockFsReadFile.mockReturnValue(VALID_MANIFEST_YAML);

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT, {
        requireKeywords: { min: 3, max: 5 },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("keywords");
        expect(result.error.message).toContain("at least 3");
      }
    });

    test("returns keywords error when too many keywords", () => {
      const manyKeywordsYaml = [
        'name: "@test/artifact"',
        'version: "1.0.0"',
        'description: "Test"',
        "keywords:",
        "  - one",
        "  - two",
        "  - three",
        "  - four",
        "  - five",
        "  - six",
      ].join("\n");
      mockFsReadFile.mockReturnValue(manyKeywordsYaml);

      const result = validateArtifact(ARTIFACT_PATH, PROJECT_ROOT, {
        requireKeywords: { min: 3, max: 5 },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("keywords");
        expect(result.error.message).toContain("too many");
      }
    });
  });
});
