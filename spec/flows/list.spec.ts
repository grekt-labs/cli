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

describe("grekt list", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("lists installed artifacts with versions", async () => {
    project = createTestProject({ initialized: true });

    await runCli(["add", "@test/artifact@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    const result = await runCli(["list"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("@test/artifact");
    expect(result.stdout).toContain("1.0.0");
  });

  test("outputs JSON with --json flag", async () => {
    project = createTestProject({ initialized: true });

    await runCli(["add", "@test/artifact@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    const result = await runCli(["list", "--json"], { cwd: project.root });

    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.artifacts).toBeDefined();
    expect(parsed.artifacts["@test/artifact"]).toBeDefined();
  });

  test("shows message when no artifacts installed", async () => {
    project = createTestProject({
      initialized: true,
      lockfile: { version: 1, artifacts: {} },
    });

    const result = await runCli(["list"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No artifacts installed");
  });

  test("errors when not initialized", async () => {
    project = createTestProject();

    const result = await runCli(["list"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
  });
});
