import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { claudePlugin } from "./claude";
import { GREKT_SECTION_HEADER, type ProjectConfig } from "@grekt-labs/cli-engine";

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

  test("getSyncPaths returns category paths under .claude", () => {
    const paths = claudePlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".claude/agents");
    expect(paths!.skills).toBe(".claude/skills");
  });

  test("getTargetPaths includes both entry points", () => {
    const targetPaths = claudePlugin.getTargetPaths();

    expect(targetPaths).not.toBeNull();
    expect(targetPaths!.targetDir).toBe(".claude");
    expect(targetPaths!.entryPoints).toEqual([".claude/CLAUDE.md", "CLAUDE.md"]);
  });

  describe("entryPoints: uses existing CLAUDE.md at root", () => {
    const testDir = join(process.cwd(), ".test-claude-entrypoints");

    beforeEach(() => {
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(join(testDir, ".claude"), { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    test("syncs to root CLAUDE.md when it exists and .claude/CLAUDE.md does not", async () => {
      writeFileSync(join(testDir, "CLAUDE.md"), "# My Project Rules\n");

      const result = await claudePlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      // Should update root CLAUDE.md, NOT create .claude/CLAUDE.md
      const content = readFileSync(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain(GREKT_SECTION_HEADER);
      expect(content).toContain("# My Project Rules");
      expect(existsSync(join(testDir, ".claude/CLAUDE.md"))).toBe(false);
      expect(result.updated).toContain("CLAUDE.md");
    });

    test("creates .claude/CLAUDE.md when neither entry point exists", async () => {
      const result = await claudePlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      expect(existsSync(join(testDir, ".claude/CLAUDE.md"))).toBe(true);
      expect(existsSync(join(testDir, "CLAUDE.md"))).toBe(false);
      expect(result.created).toContain(".claude/CLAUDE.md");
    });

    test("prefers .claude/CLAUDE.md when both exist", async () => {
      writeFileSync(join(testDir, ".claude/CLAUDE.md"), "# Inside .claude\n");
      writeFileSync(join(testDir, "CLAUDE.md"), "# At root\n");

      const result = await claudePlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      // Should update .claude/CLAUDE.md (first in entryPoints), not root
      const insideContent = readFileSync(join(testDir, ".claude/CLAUDE.md"), "utf-8");
      const rootContent = readFileSync(join(testDir, "CLAUDE.md"), "utf-8");
      expect(insideContent).toContain(GREKT_SECTION_HEADER);
      expect(rootContent).not.toContain(GREKT_SECTION_HEADER);
      expect(result.updated).toContain("CLAUDE.md"); // basename of .claude/CLAUDE.md
    });
  });
});
