import { describe, test, expect, afterEach } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt config", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── User inspects project configuration ──

  describe("listing and reading config", () => {
    test("lists all config values after init", async () => {
      project = createTestProject({ initialized: true, targets: ["claude", "cursor"] });

      const result = await runCli(["config", "list"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("targets");
      expect(result.stdout).toContain("claude");
      expect(result.stdout).toContain("cursor");
    });

    test("gets a specific config value", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["config", "get", "targets"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
    });

    test("fails when getting unknown key", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["config", "get", "nonexistent"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown key");
    });
  });

  // ── User modifies configuration ──

  describe("setting config values", () => {
    test("sets registry URL and persists it", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["config", "set", "registry", "https://custom.registry.com"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("registry");
      expect(result.stdout).toContain("https://custom.registry.com");

      // Verify it was actually persisted
      const config = parse(readFileSync(join(project.root, "grekt.yaml"), "utf-8"));
      expect(config.registry).toBe("https://custom.registry.com");
    });

    test("rejects invalid config keys with a helpful hint", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["config", "set", "banana", "yellow"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid key");
      expect(result.stdout).toContain("registry");
    });
  });

  // ── User tries config without init ──

  describe("uninitialized project", () => {
    test("config list fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["config", "list"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });

    test("config set fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["config", "set", "registry", "https://foo.com"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });
  });
});
