import { describe, test, expect } from "bun:test";
import {
  resolveAndAssertWithinBase,
  sanitizeArtifactMode,
  isSafeArtifactId,
} from "./validation";

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
  });
});
