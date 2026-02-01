import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { createFolderPlugin, createRulesOnlyPlugin } from "./base";
import { GREKT_SECTION_HEADER, type Lockfile, type ProjectConfig } from "@grekt-labs/cli-engine";

const ARTIFACTS_DIR = ".grekt/artifacts";
const TEST_ARTIFACT_ID = "@scope/artifact";

// Project config with artifact in CORE mode (so it gets copied)
const testProjectConfig: ProjectConfig = {
  targets: [],
  autoSync: false,
  artifacts: {
    [TEST_ARTIFACT_ID]: {
      version: "1.0.0",
      mode: "core",
    },
  },
  customTargets: {},
};

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
      },
    },
  };

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(artifactDir, { recursive: true });

    // Create artifact manifest (required by scanArtifact)
    writeFileSync(
      join(artifactDir, "grekt.yaml"),
      "name: artifact\nauthor: scope\nversion: 1.0.0\ndescription: Test artifact"
    );

    // Create agent file with valid frontmatter
    writeFileSync(
      join(artifactDir, "agent.md"),
      `---
grk-type: agents
grk-name: Test Agent
grk-description: A test agent
---
# Agent`
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("createFolderPlugin", () => {
    const createTestPlugin = (targetDir = ".test") =>
      createFolderPlugin({ id: "test", name: "Test", targetDir });

    test("creates full directory structure", async () => {
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(existsSync(join(testDir, ".test"))).toBe(true);
      expect(existsSync(join(testDir, ".test/agents"))).toBe(true);
      expect(existsSync(join(testDir, ".test/skills"))).toBe(true);
      expect(existsSync(join(testDir, ".test/commands"))).toBe(true);
    });

    test("copies agent file with safe name for CORE mode", async () => {
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const expectedFile = join(testDir, ".test/agents/scope-artifact_agent.md");
      expect(existsSync(expectedFile)).toBe(true);
    });

    test("skips artifact in LAZY mode (default)", async () => {
      const plugin = createTestPlugin();
      const lazyConfig: ProjectConfig = {
        ...testProjectConfig,
        artifacts: { [TEST_ARTIFACT_ID]: "1.0.0" }, // string = lazy
      };

      const result = await plugin.sync(testLockfile, testDir, { projectConfig: lazyConfig });

      expect(result.skipped.some((s) => s.includes("lazy mode"))).toBe(true);
      expect(existsSync(join(testDir, ".test/agents/scope-artifact_agent.md"))).toBe(false);
    });

    test("reports created files in result", async () => {
      const plugin = createTestPlugin();

      const result = await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(result.created.some((f) => f.includes("agents"))).toBe(true);
    });

    test("reports updated files on second sync", async () => {
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });
      const result = await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(result.updated.some((f) => f.includes("agents"))).toBe(true);
    });

    test("preview shows willCreate before sync for CORE mode", () => {
      const plugin = createTestPlugin();

      const preview = plugin.preview(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(preview.willCreate).toContain(".test");
    });

    test("preview skips LAZY mode artifacts", () => {
      const plugin = createTestPlugin();
      const lazyConfig: ProjectConfig = {
        ...testProjectConfig,
        artifacts: { [TEST_ARTIFACT_ID]: "1.0.0" },
      };

      const preview = plugin.preview(testLockfile, testDir, { projectConfig: lazyConfig });

      expect(preview.willSkip.some((s) => s.includes("lazy mode"))).toBe(true);
    });

    test("targetExists detects directory presence", () => {
      const plugin = createTestPlugin(".testdir");

      expect(plugin.targetExists(testDir)).toBe(false);

      mkdirSync(join(testDir, ".testdir"));

      expect(plugin.targetExists(testDir)).toBe(true);
    });

    test("dryRun returns preview without creating files", async () => {
      const plugin = createTestPlugin();

      const result = await plugin.sync(testLockfile, testDir, { dryRun: true, projectConfig: testProjectConfig });

      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(testDir, ".test"))).toBe(false);
    });
  });

  describe("createRulesOnlyPlugin", () => {
    const createTestPlugin = (contextEntryPoint = "RULES.md") =>
      createRulesOnlyPlugin({
        id: "test",
        name: "Test",
        contextEntryPoint,
        generateRulesContent: () => `${GREKT_SECTION_HEADER}\n\nMANAGED CONTENT`,
      });

    test("prepends managed block to existing file", async () => {
      writeFileSync(join(testDir, "RULES.md"), "# Header\n");
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});

      const content = readFileSync(join(testDir, "RULES.md"), "utf-8");
      expect(content).toContain("# Header");
      expect(content).toContain("MANAGED CONTENT");
      expect(content.startsWith(GREKT_SECTION_HEADER)).toBe(true);
    });

    test("does nothing if section header already exists", async () => {
      const initial = `${GREKT_SECTION_HEADER}\n\nEXISTING\n\n# Other`;
      writeFileSync(join(testDir, "RULES.md"), initial);
      const plugin = createTestPlugin();

      await plugin.sync(testLockfile, testDir, {});

      const content = readFileSync(join(testDir, "RULES.md"), "utf-8");
      expect(content).toContain("EXISTING");
      expect(content).not.toContain("MANAGED CONTENT");
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
