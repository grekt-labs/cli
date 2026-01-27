import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { createFolderPlugin, createRulesOnlyPlugin, GREKT_BLOCK_START, GREKT_BLOCK_END } from "./base";
import type { Lockfile } from "@grekt-labs/cli-engine";

const ARTIFACTS_DIR = ".grekt/artifacts";
const TEST_ARTIFACT_ID = "@scope/artifact";

describe("base", () => {
  const testDir = join(process.cwd(), ".test-sync-base");
  const artifactDir = join(testDir, ARTIFACTS_DIR, TEST_ARTIFACT_ID);

  const testLockfile: Lockfile = {
    version: 1,
    artifacts: {
      [TEST_ARTIFACT_ID]: {
        version: "1.0.0",
        integrity: "sha256:abc",
        files: {},
        agent: "agent.md",
        skills: [],
        commands: [],
      },
    },
  };

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(join(artifactDir, "agent.md"), "# Agent");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("createFolderPlugin", () => {
    const createTestPlugin = (targetDir = ".test") =>
      createFolderPlugin({ id: "test", name: "Test", targetDir });

    test("creates full directory structure", async () => {
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});

      expect(existsSync(join(testDir, ".test"))).toBe(true);
      expect(existsSync(join(testDir, ".test/agents"))).toBe(true);
      expect(existsSync(join(testDir, ".test/skills"))).toBe(true);
      expect(existsSync(join(testDir, ".test/commands"))).toBe(true);
    });

    test("copies agent file with artifact-based name", async () => {
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});

      const expectedFile = join(testDir, ".test/agents/@scope-artifact.md");
      expect(existsSync(expectedFile)).toBe(true);
    });

    test("reports created files in result", async () => {
      const plugin = createTestPlugin();

      const result = await plugin.sync(testLockfile, testDir, {});

      expect(result.created.some((f) => f.includes("agents"))).toBe(true);
    });

    test("reports updated files on second sync", async () => {
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});
      const result = await plugin.sync(testLockfile, testDir, {});

      expect(result.updated.some((f) => f.includes("agents"))).toBe(true);
    });

    test("preview shows willCreate before sync", () => {
      const plugin = createTestPlugin();

      const preview = plugin.preview(testLockfile, testDir);

      expect(preview.willCreate).toContain(".test");
    });

    test("targetExists detects directory presence", () => {
      const plugin = createTestPlugin(".testdir");

      expect(plugin.targetExists(testDir)).toBe(false);

      mkdirSync(join(testDir, ".testdir"));

      expect(plugin.targetExists(testDir)).toBe(true);
    });

    test("dryRun returns preview without creating files", async () => {
      const plugin = createTestPlugin();

      const result = await plugin.sync(testLockfile, testDir, { dryRun: true });

      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(testDir, ".test"))).toBe(false);
    });
  });

  describe("createRulesOnlyPlugin", () => {
    const createTestPlugin = (rulesFile = "RULES.md") =>
      createRulesOnlyPlugin({
        id: "test",
        name: "Test",
        rulesFile,
        generateRulesContent: () => `${GREKT_BLOCK_START}\nMANAGED\n${GREKT_BLOCK_END}`,
      });

    test("appends managed block to existing file", async () => {
      writeFileSync(join(testDir, "RULES.md"), "# Header\n");
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});

      const content = readFileSync(join(testDir, "RULES.md"), "utf-8");
      expect(content).toContain("# Header");
      expect(content).toContain("MANAGED");
    });

    test("replaces existing managed block", async () => {
      const initial = `Before\n${GREKT_BLOCK_START}\nOLD\n${GREKT_BLOCK_END}\nAfter`;
      writeFileSync(join(testDir, "RULES.md"), initial);
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});

      const content = readFileSync(join(testDir, "RULES.md"), "utf-8");
      expect(content).toContain("Before");
      expect(content).toContain("After");
      expect(content).toContain("MANAGED");
      expect(content).not.toContain("OLD");
    });

    test("creates file when createTarget is true", async () => {
      const plugin = createTestPlugin("NEW.md");

      await plugin.sync(testLockfile, testDir, { createTarget: true });

      expect(existsSync(join(testDir, "NEW.md"))).toBe(true);
    });

    test("skips when file missing and createTarget is false", async () => {
      const plugin = createTestPlugin("MISSING.md");

      const result = await plugin.sync(testLockfile, testDir, { createTarget: false });

      expect(result.skipped).toContain("MISSING.md (file doesn't exist)");
      expect(existsSync(join(testDir, "MISSING.md"))).toBe(false);
    });

    test("targetExists detects file presence", () => {
      const plugin = createTestPlugin("TARGET.md");

      expect(plugin.targetExists(testDir)).toBe(false);

      writeFileSync(join(testDir, "TARGET.md"), "");

      expect(plugin.targetExists(testDir)).toBe(true);
    });
  });
});
