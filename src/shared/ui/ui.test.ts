import { describe, test, expect } from "bun:test";
import { colors, symbols, spinner } from "./ui";

describe("ui", () => {
  describe("colors", () => {
    test("color functions wrap input text preserving content", () => {
      const input = "hello world";
      expect(colors.success(input)).toContain(input);
      expect(colors.error(input)).toContain(input);
      expect(colors.warning(input)).toContain(input);
      expect(colors.info(input)).toContain(input);
      expect(colors.dim(input)).toContain(input);
      expect(colors.bold(input)).toContain(input);
      expect(colors.highlight(input)).toContain(input);
    });

    test("handles empty strings without error", () => {
      expect(colors.success("")).toContain("");
      expect(colors.error("")).toContain("");
    });
  });

  describe("symbols", () => {
    test("symbols contain expected unicode characters", () => {
      expect(symbols.success).toContain("✓");
      expect(symbols.error).toContain("✗");
      expect(symbols.warning).toContain("⚠");
      expect(symbols.info).toContain("i");
      expect(symbols.arrow).toContain("→");
      expect(symbols.bullet).toContain("•");
    });
  });

  describe("spinner", () => {
    test("creates spinner with provided text", () => {
      const text = "Loading artifacts...";
      const spin = spinner(text);
      expect(spin.text).toBe(text);
    });
  });
});
