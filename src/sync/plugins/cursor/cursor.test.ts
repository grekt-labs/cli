import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { cursorPlugin } from "./cursor";
import { GREKT_SECTION_HEADER, type Lockfile, type ProjectConfig } from "@grekt/engine";

const ARTIFACTS_DIR = ".grekt/artifacts";
const TEST_ARTIFACT_ID = "@scope/artifact";

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

describe("cursorPlugin", () => {
  const testDir = join(process.cwd(), ".test-cursor-plugin");
  const artifactDir = join(testDir, ARTIFACTS_DIR, TEST_ARTIFACT_ID);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(artifactDir, { recursive: true });

    writeFileSync(
      join(artifactDir, "grekt.yaml"),
      'name: "@scope/artifact"\nversion: 1.0.0\ndescription: Test artifact'
    );

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

  test("has correct configuration", () => {
    expect(cursorPlugin.id).toBe("cursor");
    expect(cursorPlugin.name).toBe("Cursor");
    expect(cursorPlugin.targetFile).toBe(".cursor");
  });

  test("getSyncPaths returns folder paths", () => {
    const paths = cursorPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".cursor/agents");
    expect(paths!.skills).toBe(".cursor/skills");
    expect(paths!.rules).toBe(".cursor/rules");
  });

  describe("targetExists", () => {
    test("returns false when directory missing", () => {
      expect(cursorPlugin.targetExists(testDir)).toBe(false);
    });

    test("returns true when directory exists", () => {
      mkdirSync(join(testDir, ".cursor"), { recursive: true });
      expect(cursorPlugin.targetExists(testDir)).toBe(true);
    });
  });

  describe("sync", () => {
    test("creates directory structure", async () => {
      await cursorPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(existsSync(join(testDir, ".cursor"))).toBe(true);
      expect(existsSync(join(testDir, ".cursor/agents"))).toBe(true);
      expect(existsSync(join(testDir, ".cursor/skills"))).toBe(true);
    });

    test("copies agent file with safe name", async () => {
      await cursorPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const expectedFile = join(testDir, ".cursor/agents/scope-artifact_agent.md");
      expect(existsSync(expectedFile)).toBe(true);
    });

    test("prepends managed block to .cursorrules when it exists", async () => {
      writeFileSync(join(testDir, ".cursorrules"), "# My Rules");

      await cursorPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const content = readFileSync(join(testDir, ".cursorrules"), "utf-8");
      expect(content).toContain("# My Rules");
      expect(content).toContain(GREKT_SECTION_HEADER);
      expect(content.startsWith(GREKT_SECTION_HEADER)).toBe(true);
    });

    test("does not duplicate section header on re-sync", async () => {
      writeFileSync(join(testDir, ".cursorrules"), `${GREKT_SECTION_HEADER}\n\nExisting`);

      await cursorPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const content = readFileSync(join(testDir, ".cursorrules"), "utf-8");
      const occurrences = content.split(GREKT_SECTION_HEADER).length - 1;
      expect(occurrences).toBe(1);
    });

    test("installs skill router on sync", async () => {
      await cursorPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const routerPath = join(testDir, ".cursor/skills/grekt/SKILL.md");
      expect(existsSync(routerPath)).toBe(true);
    });

    test("dryRun returns preview without creating files", async () => {
      const result = await cursorPlugin.sync(testLockfile, testDir, {
        dryRun: true,
        projectConfig: testProjectConfig,
      });

      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(testDir, ".cursor"))).toBe(false);
    });
  });
});
