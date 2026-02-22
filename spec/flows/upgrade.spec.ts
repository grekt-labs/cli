import { describe, test, expect, afterEach, beforeAll, afterAll } from "bun:test";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";
import { registerArtifact, startRegistryServer } from "../helpers/registry-server";

let registry: { port: number; url: string; stop: () => void };

beforeAll(async () => {
  registerArtifact("test/artifact", "1.0.0", "test-artifact");
  registry = await startRegistryServer();
});

afterAll(() => {
  registry?.stop();
});

describe("grekt upgrade", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── User tries to upgrade on uninitialized project ──

  describe("project state validation", () => {
    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["upgrade"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });

    test("exits cleanly when no artifacts are installed", async () => {
      project = createTestProject({
        initialized: true,
        lockfile: { version: 1, artifacts: {} },
      });

      const result = await runCli(["upgrade"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No artifacts installed");
    });
  });

  // ── User tries to upgrade a specific artifact ──

  describe("targeted upgrade", () => {
    test("fails when specified artifact is not installed", async () => {
      project = createTestProject({
        initialized: true,
        artifacts: { "@test/artifact": "1.0.0" },
        lockfile: {
          version: 1,
          artifacts: {
            "@test/artifact": {
              version: "1.0.0",
              integrity: "sha256:abc123",
              source: "@test/artifact",
              mode: "lazy",
              files: {},
            },
          },
        },
      });

      const result = await runCli(["upgrade", "@vendor/nonexistent"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not installed");
    });

    test("rejects git-sourced artifact with guidance", async () => {
      project = createTestProject({
        initialized: true,
        artifacts: { "@vendor/tool": "1.0.0" },
        lockfile: {
          version: 1,
          artifacts: {
            "@vendor/tool": {
              version: "1.0.0",
              integrity: "sha256:abc123",
              source: "github:vendor/tool",
              mode: "lazy",
              files: {},
            },
          },
        },
      });

      const result = await runCli(["upgrade", "@vendor/tool"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("git source");
      expect(result.stdout).toContain("git pull");
    });
  });

  // ── User has only git-sourced artifacts ──

  describe("git source filtering", () => {
    test("reports when all artifacts are from git sources (nothing to upgrade)", async () => {
      project = createTestProject({
        initialized: true,
        artifacts: { "@vendor/tool": "1.0.0" },
        lockfile: {
          version: 1,
          artifacts: {
            "@vendor/tool": {
              version: "1.0.0",
              integrity: "sha256:abc123",
              source: "github:vendor/tool",
              mode: "lazy",
              files: {},
            },
          },
        },
      });

      const result = await runCli(["upgrade"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("git sources");
    });
  });

  // ── User upgrades artifact that is already up to date ──

  describe("already up to date", () => {
    test("reports when all artifacts are current", async () => {
      project = createTestProject({ initialized: true });

      // Add artifact via CLI so it gets proper lockfile entry
      await runCli(["add", "@test/artifact@1.0.0"], {
        cwd: project.root,
        env: { GREKT_REGISTRY_URL: registry.url },
      });

      // Only 1.0.0 is registered, so it should be "up to date"
      const result = await runCli(["upgrade"], {
        cwd: project.root,
        env: { GREKT_REGISTRY_URL: registry.url },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("up to date");
    });
  });
});
