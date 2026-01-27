import { describe, test, expect } from "bun:test";
import { colors, symbols, spinner } from "./ui";

describe("ui", () => {
  describe("colors", () => {
    test("exports all color functions", () => {
      expect(typeof colors.success).toBe("function");
      expect(typeof colors.error).toBe("function");
      expect(typeof colors.warning).toBe("function");
      expect(typeof colors.info).toBe("function");
      expect(typeof colors.dim).toBe("function");
      expect(typeof colors.bold).toBe("function");
      expect(typeof colors.highlight).toBe("function");
    });

    test("color functions return strings", () => {
      expect(typeof colors.success("test")).toBe("string");
      expect(typeof colors.error("test")).toBe("string");
      expect(typeof colors.warning("test")).toBe("string");
      expect(typeof colors.info("test")).toBe("string");
      expect(typeof colors.dim("test")).toBe("string");
      expect(typeof colors.bold("test")).toBe("string");
      expect(typeof colors.highlight("test")).toBe("string");
    });
  });

  describe("symbols", () => {
    test("exports all symbol constants", () => {
      expect(symbols.success).toBeDefined();
      expect(symbols.error).toBeDefined();
      expect(symbols.warning).toBeDefined();
      expect(symbols.info).toBeDefined();
      expect(symbols.arrow).toBeDefined();
      expect(symbols.bullet).toBeDefined();
    });

    test("symbols are strings", () => {
      expect(typeof symbols.success).toBe("string");
      expect(typeof symbols.error).toBe("string");
      expect(typeof symbols.warning).toBe("string");
      expect(typeof symbols.info).toBe("string");
      expect(typeof symbols.arrow).toBe("string");
      expect(typeof symbols.bullet).toBe("string");
    });
  });

  describe("spinner", () => {
    test("returns ora instance", () => {
      const spin = spinner("Loading...");
      expect(spin).toBeDefined();
      expect(typeof spin.start).toBe("function");
      expect(typeof spin.stop).toBe("function");
      expect(typeof spin.succeed).toBe("function");
      expect(typeof spin.fail).toBe("function");
    });
  });
});
