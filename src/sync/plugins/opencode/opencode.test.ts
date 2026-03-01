import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { opencodePlugin } from "./opencode";
import type { ProjectConfig } from "@grekt-labs/cli-engine";

const PLUGIN_ID = "opencode";
const PLUGIN_NAME = "OpenCode";
const TARGET_DIR = ".opencode";
const TEST_ARTIFACT_ID = "@test/artifact";

const coreProjectConfig: ProjectConfig = {
  targets: [],
  artifacts: {
    [TEST_ARTIFACT_ID]: { version: "1.0.0", mode: "core" },
  },
  customTargets: {},
};

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

    test("reports skipped for CORE artifacts with invalid artifact", () => {
      const lockfile = {
        version: 1,
        artifacts: {
          [TEST_ARTIFACT_ID]: {
            version: "1.0.0",
            files: {},
          },
        },
      };

      const preview = opencodePlugin.preview(lockfile, testDir, { projectConfig: coreProjectConfig });

      expect(preview.willSkip.some((s) => s.includes("invalid artifact"))).toBe(true);
    });

    test("reports skipped for LAZY mode artifacts", () => {
      const lockfile = {
        version: 1,
        artifacts: {
          [TEST_ARTIFACT_ID]: {
            version: "1.0.0",
            files: {},
          },
        },
      };

      const preview = opencodePlugin.preview(lockfile, testDir); // No config = lazy

      expect(preview.willSkip.some((s) => s.includes("lazy mode"))).toBe(true);
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

    test("skips CORE artifacts with invalid artifact", async () => {
      const missingArtifactId = "@test/missing";
      const lockfile = {
        version: 1,
        artifacts: {
          [missingArtifactId]: {
            version: "1.0.0",
            files: {},
          },
        },
      };
      const configWithMissing: ProjectConfig = {
        ...coreProjectConfig,
        artifacts: { [missingArtifactId]: { version: "1.0.0", mode: "core" } },
      };

      const result = await opencodePlugin.sync(lockfile, testDir, { projectConfig: configWithMissing });

      expect(result.skipped.some((s) => s.includes("invalid artifact"))).toBe(true);
    });

    test("skips LAZY mode artifacts", async () => {
      const lockfile = {
        version: 1,
        artifacts: {
          [TEST_ARTIFACT_ID]: {
            version: "1.0.0",
            files: {},
          },
        },
      };

      const result = await opencodePlugin.sync(lockfile, testDir, {}); // No config = lazy

      expect(result.skipped.some((s) => s.includes("lazy mode"))).toBe(true);
    });

    test("dryRun does not create directories", async () => {
      const result = await opencodePlugin.sync({ version: 1, artifacts: {} }, testDir, { dryRun: true });

      expect(result.created).toContain(TARGET_DIR);
      expect(existsSync(join(testDir, TARGET_DIR))).toBe(false);
    });
  });
});
