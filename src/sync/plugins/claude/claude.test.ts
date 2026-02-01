import { describe, test, expect } from "bun:test";
import { claudePlugin } from "./claude";
import type { ProjectConfig } from "@grekt-labs/cli-engine";

const PLUGIN_ID = "claude";
const PLUGIN_NAME = "Claude";
const TARGET_DIR = ".claude";

const TEST_ARTIFACT_ID = "@test/artifact";

const coreProjectConfig: ProjectConfig = {
  targets: [],
  artifacts: {
    [TEST_ARTIFACT_ID]: { version: "1.0.0", mode: "core" },
  },
  customTargets: {},
};

describe("claudePlugin", () => {
  test("has correct configuration", () => {
    expect(claudePlugin.id).toBe(PLUGIN_ID);
    expect(claudePlugin.name).toBe(PLUGIN_NAME);
    expect(claudePlugin.targetFile).toBe(TARGET_DIR);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(claudePlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });

  test("preview includes target directory when missing", () => {
    const lockfile = { version: 1, artifacts: {} };

    const preview = claudePlugin.preview(lockfile, "/nonexistent");

    expect(preview.willCreate).toContain(TARGET_DIR);
  });

  test("preview reports invalid artifact as skipped for CORE mode", () => {
    const lockfile = {
      version: 1,
      artifacts: {
        [TEST_ARTIFACT_ID]: {
          version: "1.0.0",
          files: { "skills/missing.md": "sha256:abc" },
        },
      },
    };

    const preview = claudePlugin.preview(lockfile, "/nonexistent", { projectConfig: coreProjectConfig });

    expect(preview.willSkip.some((s) => s.includes("invalid artifact"))).toBe(true);
  });

  test("preview skips LAZY mode artifacts", () => {
    const lockfile = {
      version: 1,
      artifacts: {
        [TEST_ARTIFACT_ID]: {
          version: "1.0.0",
          files: {},
        },
      },
    };

    const preview = claudePlugin.preview(lockfile, "/nonexistent"); // No projectConfig = lazy

    expect(preview.willSkip.some((s) => s.includes("lazy mode"))).toBe(true);
  });

  test("sync dry run returns preview without modifications", async () => {
    const lockfile = { version: 1, artifacts: {} };

    const result = await claudePlugin.sync(lockfile, "/nonexistent", { dryRun: true });

    expect(result.created).toContain(TARGET_DIR);
  });
});
