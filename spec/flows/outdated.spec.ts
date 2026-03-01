import { describe, test, expect, afterEach } from "vitest";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt outdated", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── User checks for updates on a project ──

  describe("project state validation", () => {
    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["outdated"], {
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

      const result = await runCli(["outdated"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No artifacts installed");
    });
  });

  // ── User has only git-sourced artifacts ──

  describe("git source filtering", () => {
    test("reports when all artifacts are from git sources (nothing to check)", async () => {
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
            "@other/lib": {
              version: "2.0.0",
              integrity: "sha256:def456",
              source: "gitlab:other/lib",
              mode: "lazy",
              files: {},
            },
          },
        },
      });

      const result = await runCli(["outdated"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("git sources");
    });
  });
});
