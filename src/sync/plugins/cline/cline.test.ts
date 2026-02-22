import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { clinePlugin } from "./cline";
import { type Lockfile, type ProjectConfig } from "@grekt-labs/cli-engine";

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

describe("clinePlugin", () => {
  const testDir = join(process.cwd(), ".test-cline-plugin");
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
    expect(clinePlugin.id).toBe("cline");
    expect(clinePlugin.name).toBe("Cline");
    expect(clinePlugin.targetFile).toBe(".clinerules");
  });

  test("getSyncPaths returns folder paths", () => {
    const paths = clinePlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".clinerules/agents");
    expect(paths!.skills).toBe(".clinerules/skills");
    expect(paths!.rules).toBe(".clinerules/rules");
  });

  describe("targetExists", () => {
    test("returns false when directory missing", () => {
      expect(clinePlugin.targetExists(testDir)).toBe(false);
    });

    test("returns true when directory exists", () => {
      mkdirSync(join(testDir, ".clinerules"), { recursive: true });
      expect(clinePlugin.targetExists(testDir)).toBe(true);
    });
  });

  describe("sync", () => {
    test("creates directory structure", async () => {
      await clinePlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(existsSync(join(testDir, ".clinerules"))).toBe(true);
      expect(existsSync(join(testDir, ".clinerules/agents"))).toBe(true);
      expect(existsSync(join(testDir, ".clinerules/skills"))).toBe(true);
    });

    test("copies agent file with safe name", async () => {
      await clinePlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const expectedFile = join(testDir, ".clinerules/agents/scope-artifact_agent.md");
      expect(existsSync(expectedFile)).toBe(true);
    });

    test("installs skill router on sync", async () => {
      await clinePlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const routerPath = join(testDir, ".clinerules/skills/grekt/SKILL.md");
      expect(existsSync(routerPath)).toBe(true);
    });

    test("dryRun returns preview without creating files", async () => {
      const result = await clinePlugin.sync(testLockfile, testDir, {
        dryRun: true,
        projectConfig: testProjectConfig,
      });

      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(testDir, ".clinerules/agents"))).toBe(false);
    });
  });
});
