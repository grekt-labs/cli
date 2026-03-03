import { describe, test, expect } from "vitest";
import { openclawPlugin } from "./openclaw";
import type { ProjectConfig } from "@grekt/engine";

const PLUGIN_ID = "openclaw";
const PLUGIN_NAME = "OpenClaw";
const TARGET_DIR = "skills";

const TEST_ARTIFACT_ID = "@test/artifact";

const coreProjectConfig: ProjectConfig = {
  targets: [],
  artifacts: {
    [TEST_ARTIFACT_ID]: { version: "1.0.0", mode: "core" },
  },
  customTargets: {},
};

describe("openclawPlugin", () => {
  test("has correct configuration", () => {
    expect(openclawPlugin.id).toBe(PLUGIN_ID);
    expect(openclawPlugin.name).toBe(PLUGIN_NAME);
    expect(openclawPlugin.targetFile).toBe(TARGET_DIR);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(openclawPlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });

  test("preview includes target directory when missing", () => {
    const lockfile = { version: 1 as const, artifacts: {} };

    const preview = openclawPlugin.preview(lockfile, "/nonexistent");

    expect(preview.willCreate).toContain(TARGET_DIR);
  });

  test("preview reports invalid artifact as skipped for CORE mode", () => {
    const lockfile = {
      version: 1 as const,
      artifacts: {
        [TEST_ARTIFACT_ID]: {
          version: "1.0.0",
          integrity: "sha256:abc",
          mode: "core" as const,
          files: { "skills/missing.md": "sha256:abc" },
        },
      },
    };

    const preview = openclawPlugin.preview(lockfile, "/nonexistent", { projectConfig: coreProjectConfig });

    expect(preview.willSkip.some((s) => s.includes("invalid artifact"))).toBe(true);
  });

  test("preview skips LAZY mode artifacts", () => {
    const lockfile = {
      version: 1 as const,
      artifacts: {
        [TEST_ARTIFACT_ID]: {
          version: "1.0.0",
          integrity: "sha256:abc",
          mode: "lazy" as const,
          files: {},
        },
      },
    };

    const preview = openclawPlugin.preview(lockfile, "/nonexistent");

    expect(preview.willSkip.some((s) => s.includes("lazy mode"))).toBe(true);
  });

  test("sync dry run returns preview without modifications", async () => {
    const lockfile = { version: 1 as const, artifacts: {} };

    const result = await openclawPlugin.sync(lockfile, "/nonexistent", { dryRun: true });

    expect(result.created).toContain(TARGET_DIR);
  });

  test("getSyncPaths returns category paths under skills", () => {
    const paths = openclawPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.skills).toBe("skills/skills");
    expect(paths!.agents).toBe("skills/agents");
    expect(paths!.commands).toBe("skills/commands");
  });

  test("getTargetPaths includes AGENTS.md entry point", () => {
    const targetPaths = openclawPlugin.getTargetPaths();

    expect(targetPaths).not.toBeNull();
    expect(targetPaths!.targetDir).toBe("skills");
    expect(targetPaths!.entryPoints).toEqual(["AGENTS.md"]);
  });

  test("resolveTargetPath generates correct skill folder structure", () => {
    const result = openclawPlugin.resolveTargetPath!(TEST_ARTIFACT_ID, "skills", "my-skill.md");

    expect(result).toBe("test-artifact-my-skill/SKILL.md");
  });

  test("resolveTargetPath adds agent- prefix for agents", () => {
    const result = openclawPlugin.resolveTargetPath!(TEST_ARTIFACT_ID, "agents", "reviewer.md");

    expect(result).toBe("agent-test-artifact-reviewer/SKILL.md");
  });

  test("resolveTargetPath uses artifact name only for SKILL.md files", () => {
    const result = openclawPlugin.resolveTargetPath!(TEST_ARTIFACT_ID, "skills", "SKILL.md");

    expect(result).toBe("test-artifact/SKILL.md");
  });
});
