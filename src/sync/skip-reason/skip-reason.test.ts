import { describe, test, expect } from "bun:test";
import {
  formatSkipped,
  parseSkipped,
  isSkipReason,
  extractSkippedPath,
  type SkipReason,
} from "./skip-reason";

describe("skip-reason", () => {
  describe("formatSkipped", () => {
    test("formats lazy reason", () => {
      expect(formatSkipped("@scope/name", "lazy")).toBe("@scope/name (lazy mode)");
    });

    test("formats invalid-artifact reason", () => {
      expect(formatSkipped("@scope/name", "invalid-artifact")).toBe("@scope/name (invalid artifact)");
    });

    test("formats unsafe-path reason", () => {
      expect(formatSkipped("@scope/name/file.md", "unsafe-path")).toBe("@scope/name/file.md (unsafe path)");
    });

    test("formats source-not-found reason", () => {
      expect(formatSkipped("@scope/name/file.md", "source-not-found")).toBe("@scope/name/file.md (source not found)");
    });

    test("formats file-not-found reason", () => {
      expect(formatSkipped(".claude/CLAUDE.md", "file-not-found")).toBe(".claude/CLAUDE.md (file doesn't exist)");
    });
  });

  describe("parseSkipped", () => {
    test("parses all known reasons", () => {
      const cases: Array<[string, string, SkipReason]> = [
        ["@scope/name (lazy mode)", "@scope/name", "lazy"],
        ["@scope/name (invalid artifact)", "@scope/name", "invalid-artifact"],
        ["@scope/name/file.md (unsafe path)", "@scope/name/file.md", "unsafe-path"],
        ["@scope/name/file.md (source not found)", "@scope/name/file.md", "source-not-found"],
        [".claude/CLAUDE.md (file doesn't exist)", ".claude/CLAUDE.md", "file-not-found"],
      ];

      for (const [input, expectedPath, expectedReason] of cases) {
        const result = parseSkipped(input);
        expect(result).not.toBeNull();
        expect(result!.path).toBe(expectedPath);
        expect(result!.reason).toBe(expectedReason);
      }
    });

    test("returns null for unknown reason", () => {
      expect(parseSkipped("@scope/name (unknown reason)")).toBeNull();
    });

    test("returns null for malformed string", () => {
      expect(parseSkipped("just a string")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(parseSkipped("")).toBeNull();
    });
  });

  describe("isSkipReason", () => {
    test("returns true for matching reason", () => {
      expect(isSkipReason("@scope/name (lazy mode)", "lazy")).toBe(true);
      expect(isSkipReason("@scope/name (invalid artifact)", "invalid-artifact")).toBe(true);
    });

    test("returns false for non-matching reason", () => {
      expect(isSkipReason("@scope/name (lazy mode)", "invalid-artifact")).toBe(false);
      expect(isSkipReason("@scope/name (invalid artifact)", "lazy")).toBe(false);
    });
  });

  describe("extractSkippedPath", () => {
    test("extracts path when reason matches", () => {
      expect(extractSkippedPath("@scope/name (lazy mode)", "lazy")).toBe("@scope/name");
      expect(extractSkippedPath("@scope/name/file.md (source not found)", "source-not-found")).toBe("@scope/name/file.md");
    });

    test("returns original string when reason does not match", () => {
      expect(extractSkippedPath("@scope/name (lazy mode)", "invalid-artifact")).toBe("@scope/name (lazy mode)");
    });
  });

  describe("roundtrip", () => {
    test("formatSkipped output can be parsed back", () => {
      const reasons: SkipReason[] = ["lazy", "invalid-artifact", "unsafe-path", "source-not-found", "file-not-found"];

      for (const reason of reasons) {
        const path = "@scope/test-artifact";
        const formatted = formatSkipped(path, reason);
        const parsed = parseSkipped(formatted);

        expect(parsed).not.toBeNull();
        expect(parsed!.path).toBe(path);
        expect(parsed!.reason).toBe(reason);
      }
    });
  });
});
