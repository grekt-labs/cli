import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { codexPlugin } from "./codex";
import { GREKT_SECTION_HEADER, type ProjectConfig } from "@grekt-labs/cli-engine";

const PLUGIN_ID = "codex";
const PLUGIN_NAME = "Codex";
const TARGET_DIR = ".agents";

const TEST_ARTIFACT_ID = "@test/artifact";

const coreProjectConfig: ProjectConfig = {
  targets: [],
  artifacts: {
    [TEST_ARTIFACT_ID]: { version: "1.0.0", mode: "core" },
  },
  customTargets: {},
};

describe("codexPlugin", () => {
  const testDir = join(process.cwd(), ".test-codex-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(codexPlugin.id).toBe(PLUGIN_ID);
    expect(codexPlugin.name).toBe(PLUGIN_NAME);
    expect(codexPlugin.targetFile).toBe(TARGET_DIR);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(codexPlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });

  test("targetExists detects directory presence", () => {
    expect(codexPlugin.targetExists(testDir)).toBe(false);

    mkdirSync(join(testDir, TARGET_DIR), { recursive: true });

    expect(codexPlugin.targetExists(testDir)).toBe(true);
  });

  test("getSyncPaths returns category paths under .agents", () => {
    const paths = codexPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.skills).toBe(".agents/skills");
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = codexPlugin.getTargetPaths();

    expect(targetPaths).not.toBeNull();
    expect(targetPaths!.targetDir).toBe(TARGET_DIR);
    expect(targetPaths!.entryPoints).toEqual(["AGENTS.md"]);
  });

  test("preview includes target directory when missing", () => {
    const lockfile = { version: 1, artifacts: {} };

    const preview = codexPlugin.preview(lockfile, "/nonexistent");

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

    const preview = codexPlugin.preview(lockfile, "/nonexistent", { projectConfig: coreProjectConfig });

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

    const preview = codexPlugin.preview(lockfile, "/nonexistent"); // No projectConfig = lazy

    expect(preview.willSkip.some((s) => s.includes("lazy mode"))).toBe(true);
  });

  test("sync dry run returns preview without modifications", async () => {
    const lockfile = { version: 1, artifacts: {} };

    const result = await codexPlugin.sync(lockfile, "/nonexistent", { dryRun: true });

    expect(result.created).toContain(TARGET_DIR);
  });

  test("resolveTargetPath maps skills to folder structure", () => {
    const targetPath = codexPlugin.resolveTargetPath!(
      "@test/artifact",
      "skills",
      "skills/create-module.md",
    );

    expect(targetPath).toBe("test-artifact-create-module/SKILL.md");
  });

  describe("AGENTS.md entry point", () => {
    test("creates AGENTS.md when it does not exist", async () => {
      mkdirSync(join(testDir, TARGET_DIR), { recursive: true });

      const result = await codexPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      expect(existsSync(join(testDir, "AGENTS.md"))).toBe(true);
      expect(result.created).toContain("AGENTS.md");
    });

    test("prepends to existing AGENTS.md", async () => {
      mkdirSync(join(testDir, TARGET_DIR), { recursive: true });
      writeFileSync(join(testDir, "AGENTS.md"), "# My Project\n");

      const result = await codexPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");
      expect(content).toContain(GREKT_SECTION_HEADER);
      expect(content).toContain("# My Project");
      expect(result.updated).toContain("AGENTS.md");
    });

    test("does not duplicate entry point text", async () => {
      mkdirSync(join(testDir, TARGET_DIR), { recursive: true });
      writeFileSync(join(testDir, "AGENTS.md"), `${GREKT_SECTION_HEADER} existing content\n`);

      await codexPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");
      const occurrences = content.split(GREKT_SECTION_HEADER).length - 1;
      expect(occurrences).toBe(1);
    });
  });
});
