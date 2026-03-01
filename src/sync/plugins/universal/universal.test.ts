import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { globalPlugin } from "./universal";
import { GREKT_SECTION_HEADER, type ProjectConfig } from "@grekt-labs/cli-engine";

const PLUGIN_ID = "global";
const PLUGIN_NAME = "Global (.agents/)";
const TARGET_DIR = ".agents";

const TEST_ARTIFACT_ID = "@test/artifact";

const coreProjectConfig: ProjectConfig = {
  targets: [],
  artifacts: {
    [TEST_ARTIFACT_ID]: { version: "1.0.0", mode: "core" },
  },
  customTargets: {},
};

describe("globalPlugin", () => {
  const testDir = join(process.cwd(), ".test-global-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(globalPlugin.id).toBe(PLUGIN_ID);
    expect(globalPlugin.name).toBe(PLUGIN_NAME);
    expect(globalPlugin.targetFile).toBe(TARGET_DIR);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(globalPlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });

  test("targetExists detects directory presence", () => {
    expect(globalPlugin.targetExists(testDir)).toBe(false);

    mkdirSync(join(testDir, TARGET_DIR), { recursive: true });

    expect(globalPlugin.targetExists(testDir)).toBe(true);
  });

  test("getSyncPaths returns category paths under .agents", () => {
    const paths = globalPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.skills).toBe(".agents/skills");
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = globalPlugin.getTargetPaths();

    expect(targetPaths).not.toBeNull();
    expect(targetPaths!.targetDir).toBe(TARGET_DIR);
    expect(targetPaths!.entryPoints).toEqual(["AGENTS.md"]);
  });

  test("preview includes target directory when missing", () => {
    const lockfile = { version: 1, artifacts: {} };

    const preview = globalPlugin.preview(lockfile, "/nonexistent");

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

    const preview = globalPlugin.preview(lockfile, "/nonexistent", { projectConfig: coreProjectConfig });

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

    const preview = globalPlugin.preview(lockfile, "/nonexistent"); // No projectConfig = lazy

    expect(preview.willSkip.some((s) => s.includes("lazy mode"))).toBe(true);
  });

  test("sync dry run returns preview without modifications", async () => {
    const lockfile = { version: 1, artifacts: {} };

    const result = await globalPlugin.sync(lockfile, "/nonexistent", { dryRun: true });

    expect(result.created).toContain(TARGET_DIR);
  });

  test("resolveTargetPath maps skills to folder structure", () => {
    const targetPath = globalPlugin.resolveTargetPath!(
      "@test/artifact",
      "skills",
      "skills/create-module.md",
    );

    expect(targetPath).toBe("test-artifact-create-module/SKILL.md");
  });

  describe("AGENTS.md entry point", () => {
    test("creates AGENTS.md when it does not exist", async () => {
      mkdirSync(join(testDir, TARGET_DIR), { recursive: true });

      const result = await globalPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      expect(existsSync(join(testDir, "AGENTS.md"))).toBe(true);
      expect(result.created).toContain("AGENTS.md");
    });

    test("prepends to existing AGENTS.md", async () => {
      mkdirSync(join(testDir, TARGET_DIR), { recursive: true });
      writeFileSync(join(testDir, "AGENTS.md"), "# My Project\n");

      const result = await globalPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");
      expect(content).toContain(GREKT_SECTION_HEADER);
      expect(content).toContain("# My Project");
      expect(result.updated).toContain("AGENTS.md");
    });

    test("does not duplicate entry point text", async () => {
      mkdirSync(join(testDir, TARGET_DIR), { recursive: true });
      writeFileSync(join(testDir, "AGENTS.md"), `${GREKT_SECTION_HEADER} existing content\n`);

      await globalPlugin.sync({ version: 1, artifacts: {} }, testDir, {});

      const content = readFileSync(join(testDir, "AGENTS.md"), "utf-8");
      const occurrences = content.split(GREKT_SECTION_HEADER).length - 1;
      expect(occurrences).toBe(1);
    });
  });
});
