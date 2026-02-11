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
      "name: \"@scope/artifact\"\nversion: 1.0.0\ndescription: Test artifact"
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

    test("cleans up synced files when artifact switches from CORE to LAZY", async () => {
      const plugin = createTestPlugin();

      // First sync with CORE mode - files get copied
      await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });
      const syncedFile = join(testDir, ".test/agents/scope-artifact_agent.md");
      expect(existsSync(syncedFile)).toBe(true);

      // Second sync with LAZY mode - files should be cleaned up
      const lazyConfig: ProjectConfig = {
        ...testProjectConfig,
        artifacts: { [TEST_ARTIFACT_ID]: "1.0.0" }, // string = lazy
      };

      const result = await plugin.sync(testLockfile, testDir, { projectConfig: lazyConfig });

      expect(result.skipped.some((s) => s.includes("lazy mode"))).toBe(true);
      expect(existsSync(syncedFile)).toBe(false);
    });

    test("cleans up folder-based targets when switching CORE to LAZY", async () => {
      // Plugin with custom getTargetPath that creates folder structure (like Claude skills)
      const plugin = createFolderPlugin({
        id: "test",
        name: "Test",
        targetDir: ".test",
        getTargetPath: (_artifactId, category, filePath) => {
          if (category === "skills") {
            const skillName = filePath.replace(".md", "");
            return `${skillName}-folder/SKILL.md`;
          }
          return null;
        },
      });

      // Create a skill file in the artifact
      writeFileSync(
        join(artifactDir, "my-skill.md"),
        `---
grk-type: skills
grk-name: My Skill
grk-description: A skill
---
# Skill`
      );

      // First sync with CORE mode
      await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });
      const skillFolder = join(testDir, ".test/skills/my-skill-folder");
      const skillFile = join(skillFolder, "SKILL.md");
      expect(existsSync(skillFile)).toBe(true);

      // Switch to LAZY - folder should be cleaned up
      const lazyConfig: ProjectConfig = {
        ...testProjectConfig,
        artifacts: { [TEST_ARTIFACT_ID]: "1.0.0" },
      };

      await plugin.sync(testLockfile, testDir, { projectConfig: lazyConfig });

      expect(existsSync(skillFile)).toBe(false);
      expect(existsSync(skillFolder)).toBe(false);
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

    test("getSyncPaths returns category paths", () => {
      const plugin = createTestPlugin(".test");

      const paths = plugin.getSyncPaths();

      expect(paths).not.toBeNull();
      expect(paths!.agents).toBe(".test/agents");
      expect(paths!.skills).toBe(".test/skills");
      expect(paths!.commands).toBe(".test/commands");
    });

    test("getTargetPaths returns targetDir and entryPoints", () => {
      const plugin = createFolderPlugin({
        id: "test",
        name: "Test",
        targetDir: ".test",
        entryPoints: [".test/RULES.md", "RULES.md"],
      });

      const targetPaths = plugin.getTargetPaths();

      expect(targetPaths).not.toBeNull();
      expect(targetPaths!.targetDir).toBe(".test");
      expect(targetPaths!.entryPoints).toEqual([".test/RULES.md", "RULES.md"]);
    });

    test("getTargetPaths returns empty entryPoints when none configured", () => {
      const plugin = createTestPlugin();

      const targetPaths = plugin.getTargetPaths();

      expect(targetPaths!.entryPoints).toEqual([]);
    });

    describe("entryPoints array", () => {
      test("finds existing alternative entry point", async () => {
        // Create RULES.md at root (second entry point)
        writeFileSync(join(testDir, "RULES.md"), "# Existing");

        const plugin = createFolderPlugin({
          id: "test",
          name: "Test",
          targetDir: ".test",
          entryPoints: [".test/RULES.md", "RULES.md"],
          generateRulesContent: () => `${GREKT_SECTION_HEADER}\n\nMANAGED`,
        });

        await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

        // Should update the existing RULES.md, not create .test/RULES.md
        const content = readFileSync(join(testDir, "RULES.md"), "utf-8");
        expect(content).toContain("MANAGED");
        expect(content).toContain("# Existing");
      });

      test("creates at first entry point when none exist", async () => {
        const plugin = createFolderPlugin({
          id: "test",
          name: "Test",
          targetDir: ".test",
          entryPoints: [".test/RULES.md", "RULES.md"],
          generateRulesContent: () => `${GREKT_SECTION_HEADER}\n\nMANAGED`,
        });

        await plugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

        expect(existsSync(join(testDir, ".test/RULES.md"))).toBe(true);
        expect(existsSync(join(testDir, "RULES.md"))).toBe(false);
      });

      test("preview finds existing alternative", () => {
        writeFileSync(join(testDir, "RULES.md"), "# Existing");

        const plugin = createFolderPlugin({
          id: "test",
          name: "Test",
          targetDir: ".test",
          entryPoints: [".test/RULES.md", "RULES.md"],
          generateRulesContent: () => `${GREKT_SECTION_HEADER}\n\nMANAGED`,
        });

        const preview = plugin.preview(testLockfile, testDir, { projectConfig: testProjectConfig });

        expect(preview.willUpdate).toContain("RULES.md");
        expect(preview.willCreate).not.toContain(".test/RULES.md");
      });
    });
  });

  describe("createRulesOnlyPlugin", () => {
    const createTestPlugin = (entryPoints = ["RULES.md"]) =>
      createRulesOnlyPlugin({
        id: "test",
        name: "Test",
        entryPoints,
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
      const plugin = createTestPlugin(["NEW.md"]);

      await plugin.sync(testLockfile, testDir, { createTarget: true });

      expect(existsSync(join(testDir, "NEW.md"))).toBe(true);
    });

    test("skips when file missing and createTarget is false", async () => {
      const plugin = createTestPlugin(["MISSING.md"]);

      const result = await plugin.sync(testLockfile, testDir, { createTarget: false });

      expect(result.skipped).toContain("MISSING.md (file doesn't exist)");
      expect(existsSync(join(testDir, "MISSING.md"))).toBe(false);
    });

    test("targetExists detects file presence", () => {
      const plugin = createTestPlugin(["TARGET.md"]);

      expect(plugin.targetExists(testDir)).toBe(false);

      writeFileSync(join(testDir, "TARGET.md"), "");

      expect(plugin.targetExists(testDir)).toBe(true);
    });

    test("getSyncPaths returns null", () => {
      const plugin = createTestPlugin();

      expect(plugin.getSyncPaths()).toBeNull();
    });

    test("getTargetPaths returns empty targetDir and entryPoints", () => {
      const plugin = createTestPlugin([".cursorrules"]);

      const targetPaths = plugin.getTargetPaths();

      expect(targetPaths).not.toBeNull();
      expect(targetPaths!.targetDir).toBe("");
      expect(targetPaths!.entryPoints).toEqual([".cursorrules"]);
    });

    describe("entryPoints array", () => {
      test("finds existing alternative entry point", async () => {
        writeFileSync(join(testDir, "ALT.md"), "# Alt");

        const plugin = createTestPlugin(["PRIMARY.md", "ALT.md"]);

        await plugin.sync(testLockfile, testDir, {});

        const content = readFileSync(join(testDir, "ALT.md"), "utf-8");
        expect(content).toContain("MANAGED CONTENT");
        expect(content).toContain("# Alt");
        expect(existsSync(join(testDir, "PRIMARY.md"))).toBe(false);
      });

      test("creates at first entry point when none exist and createTarget is true", async () => {
        const plugin = createTestPlugin(["PRIMARY.md", "ALT.md"]);

        await plugin.sync(testLockfile, testDir, { createTarget: true });

        expect(existsSync(join(testDir, "PRIMARY.md"))).toBe(true);
        expect(existsSync(join(testDir, "ALT.md"))).toBe(false);
      });

      test("targetExists returns true if any entry point exists", () => {
        const plugin = createTestPlugin(["PRIMARY.md", "ALT.md"]);

        expect(plugin.targetExists(testDir)).toBe(false);

        writeFileSync(join(testDir, "ALT.md"), "");

        expect(plugin.targetExists(testDir)).toBe(true);
      });

      test("preview shows willCreate with first entry point when none exist", () => {
        const plugin = createTestPlugin(["PRIMARY.md", "ALT.md"]);

        const preview = plugin.preview(testLockfile, testDir);

        expect(preview.willCreate).toContain("PRIMARY.md");
      });

      test("preview shows willUpdate with existing alternative", () => {
        writeFileSync(join(testDir, "ALT.md"), "content");

        const plugin = createTestPlugin(["PRIMARY.md", "ALT.md"]);

        const preview = plugin.preview(testLockfile, testDir);

        expect(preview.willUpdate).toContain("ALT.md");
        expect(preview.willCreate).not.toContain("PRIMARY.md");
      });
    });
  });
});
