import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { copilotPlugin } from "./copilot";
import { GREKT_SECTION_HEADER, type Lockfile, type ProjectConfig } from "@grekt-labs/cli-engine";

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

describe("copilotPlugin", () => {
  const testDir = join(process.cwd(), ".test-copilot-plugin");
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
    expect(copilotPlugin.id).toBe("copilot");
    expect(copilotPlugin.name).toBe("Copilot");
    expect(copilotPlugin.targetFile).toBe(".github");
  });

  test("getSyncPaths returns folder paths", () => {
    const paths = copilotPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".github/agents");
    expect(paths!.skills).toBe(".github/skills");
    expect(paths!.rules).toBe(".github/rules");
  });

  describe("targetExists", () => {
    test("returns false when directory missing", () => {
      expect(copilotPlugin.targetExists(testDir)).toBe(false);
    });

    test("returns true when directory exists", () => {
      mkdirSync(join(testDir, ".github"), { recursive: true });
      expect(copilotPlugin.targetExists(testDir)).toBe(true);
    });
  });

  describe("sync", () => {
    test("creates directory structure", async () => {
      await copilotPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      expect(existsSync(join(testDir, ".github"))).toBe(true);
      expect(existsSync(join(testDir, ".github/agents"))).toBe(true);
      expect(existsSync(join(testDir, ".github/skills"))).toBe(true);
    });

    test("copies agent file with safe name", async () => {
      await copilotPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const expectedFile = join(testDir, ".github/agents/scope-artifact_agent.md");
      expect(existsSync(expectedFile)).toBe(true);
    });

    test("prepends managed block to copilot-instructions.md when it exists", async () => {
      mkdirSync(join(testDir, ".github"), { recursive: true });
      writeFileSync(join(testDir, ".github/copilot-instructions.md"), "# My Instructions");

      await copilotPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const content = readFileSync(join(testDir, ".github/copilot-instructions.md"), "utf-8");
      expect(content).toContain("# My Instructions");
      expect(content).toContain(GREKT_SECTION_HEADER);
    });

    test("installs skill router on sync", async () => {
      await copilotPlugin.sync(testLockfile, testDir, { projectConfig: testProjectConfig });

      const routerPath = join(testDir, ".github/skills/grekt/SKILL.md");
      expect(existsSync(routerPath)).toBe(true);
    });

    test("dryRun returns preview without creating files", async () => {
      const result = await copilotPlugin.sync(testLockfile, testDir, {
        dryRun: true,
        projectConfig: testProjectConfig,
      });

      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(join(testDir, ".github/agents"))).toBe(false);
    });
  });
});
