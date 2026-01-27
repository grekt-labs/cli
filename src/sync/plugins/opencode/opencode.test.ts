import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { opencodePlugin } from "./opencode";

const PLUGIN_ID = "opencode";
const PLUGIN_NAME = "OpenCode";
const TARGET_DIR = ".opencode";

describe("opencodePlugin", () => {
  const testDir = join(process.cwd(), ".test-opencode-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(opencodePlugin.id).toBe(PLUGIN_ID);
    expect(opencodePlugin.name).toBe(PLUGIN_NAME);
    expect(opencodePlugin.targetFile).toBe(TARGET_DIR);
  });

  describe("targetExists", () => {
    test("returns false when directory missing", () => {
      expect(opencodePlugin.targetExists(testDir)).toBe(false);
    });

    test("returns true when directory exists", () => {
      mkdirSync(join(testDir, TARGET_DIR));
      expect(opencodePlugin.targetExists(testDir)).toBe(true);
    });
  });

  describe("preview", () => {
    test("reports willCreate when directory missing", () => {
      const preview = opencodePlugin.preview({ version: 1, artifacts: {} }, testDir);
      expect(preview.willCreate).toContain(TARGET_DIR);
    });

    test("reports skipped for artifacts with missing source files", () => {
      const lockfile = {
        version: 1,
        artifacts: {
          "@test/artifact": {
            version: "1.0.0",
            agent: "agent.md",
            skills: [],
            commands: [],
          },
        },
      };

      const preview = opencodePlugin.preview(lockfile, testDir);

      expect(preview.willSkip.some((s) => s.includes("source not found"))).toBe(true);
    });
  });

  describe("sync", () => {
    test("creates full directory structure", async () => {
      await opencodePlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      expect(existsSync(join(testDir, TARGET_DIR))).toBe(true);
      expect(existsSync(join(testDir, TARGET_DIR, "agents"))).toBe(true);
      expect(existsSync(join(testDir, TARGET_DIR, "skills"))).toBe(true);
      expect(existsSync(join(testDir, TARGET_DIR, "commands"))).toBe(true);
    });

    test("skips artifacts when source files missing", async () => {
      const lockfile = {
        version: 1,
        artifacts: {
          "@test/missing": {
            version: "1.0.0",
            agent: "agent.md",
            skills: [],
            commands: [],
          },
        },
      };

      const result = await opencodePlugin.sync(lockfile, testDir, {});

      expect(result.skipped.some((s) => s.includes("source not found"))).toBe(true);
    });

    test("dryRun does not create directories", async () => {
      const result = await opencodePlugin.sync({ version: 1, artifacts: {} }, testDir, { dryRun: true });

      expect(result.created).toContain(TARGET_DIR);
      expect(existsSync(join(testDir, TARGET_DIR))).toBe(false);
    });
  });
});
