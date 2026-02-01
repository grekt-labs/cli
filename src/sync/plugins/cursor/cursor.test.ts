import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { cursorPlugin } from "./cursor";
import { GREKT_SECTION_HEADER } from "@grekt-labs/cli-engine";

const PLUGIN_ID = "cursor";
const PLUGIN_NAME = "Cursor";
const RULES_FILE = ".cursorrules";

describe("cursorPlugin", () => {
  const testDir = join(process.cwd(), ".test-cursor-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(cursorPlugin.id).toBe(PLUGIN_ID);
    expect(cursorPlugin.name).toBe(PLUGIN_NAME);
    expect(cursorPlugin.targetFile).toBe(RULES_FILE);
  });

  describe("targetExists", () => {
    test("returns false when file missing", () => {
      expect(cursorPlugin.targetExists(testDir)).toBe(false);
    });

    test("returns true when file exists", () => {
      writeFileSync(join(testDir, RULES_FILE), "content");
      expect(cursorPlugin.targetExists(testDir)).toBe(true);
    });
  });

  describe("preview", () => {
    test("reports willCreate when file missing", () => {
      const preview = cursorPlugin.preview({ version: 1, artifacts: {} }, testDir);

      expect(preview.willCreate).toContain(RULES_FILE);
      expect(preview.willUpdate).toHaveLength(0);
    });

    test("reports willUpdate when file exists", () => {
      writeFileSync(join(testDir, RULES_FILE), "existing");

      const preview = cursorPlugin.preview({ version: 1, artifacts: {} }, testDir);

      expect(preview.willUpdate).toContain(RULES_FILE);
      expect(preview.willCreate).toHaveLength(0);
    });
  });

  describe("sync", () => {
    test("creates file when createTarget is true", async () => {
      const result = await cursorPlugin.sync({ version: 1, artifacts: {} }, testDir, { createTarget: true });

      expect(result.created).toContain(RULES_FILE);
      expect(existsSync(join(testDir, RULES_FILE))).toBe(true);
    });

    test("skips creation when createTarget is false", async () => {
      const result = await cursorPlugin.sync({ version: 1, artifacts: {} }, testDir, { createTarget: false });

      expect(result.skipped).toContain(`${RULES_FILE} (file doesn't exist)`);
      expect(existsSync(join(testDir, RULES_FILE))).toBe(false);
    });

    test("prepends managed block to existing content", async () => {
      const existingContent = "# My Rules";
      writeFileSync(join(testDir, RULES_FILE), existingContent);

      await cursorPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      const content = readFileSync(join(testDir, RULES_FILE), "utf-8");
      expect(content).toContain(existingContent);
      expect(content).toContain(GREKT_SECTION_HEADER);
      expect(content.startsWith(GREKT_SECTION_HEADER)).toBe(true);
    });

    test("does nothing if section header already exists", async () => {
      const existingContent = `${GREKT_SECTION_HEADER}\n\nEXISTING\n\n# Footer`;
      writeFileSync(join(testDir, RULES_FILE), existingContent);

      await cursorPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      const content = readFileSync(join(testDir, RULES_FILE), "utf-8");
      expect(content).toContain("EXISTING");
      expect(content).toContain("# Footer");
    });

    test("dryRun returns preview without file changes", async () => {
      writeFileSync(join(testDir, RULES_FILE), "original");

      const result = await cursorPlugin.sync({ version: 1, artifacts: {} }, testDir, { dryRun: true });

      expect(result.updated).toContain(RULES_FILE);
      expect(readFileSync(join(testDir, RULES_FILE), "utf-8")).toBe("original");
    });
  });
});
