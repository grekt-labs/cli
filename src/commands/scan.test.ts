import { describe, test, expect } from "bun:test";
import { parseSource } from "#/registry/sources/sources";
import { formatBadge, severityIcon, truncate } from "./scan";

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
});
