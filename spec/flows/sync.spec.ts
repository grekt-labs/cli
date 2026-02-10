import { describe, test, expect, afterEach, beforeAll, afterAll } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
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

async function projectWithArtifact(): Promise<TestProject> {
  const project = createTestProject({ initialized: true });
  await runCli(["add", "@test/artifact@1.0.0"], {
    cwd: project.root,
    env: { GREKT_REGISTRY_URL: registry.url },
  });
  return project;
}

describe("grekt sync", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("syncs artifacts to Claude target", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["sync", "--force"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Sync complete");

    // Claude target file should exist
    const claudeDir = join(project.root, ".claude");
    expect(existsSync(claudeDir)).toBe(true);
  });

  test("shows preview with --dry-run", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["sync", "--dry-run"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Would|Dry run/i);
  });

  test("warns when no targets configured", async () => {
    project = createTestProject({
      initialized: true,
      targets: [],
      lockfile: { version: 1, artifacts: {} },
    });

    const result = await runCli(["sync"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No sync targets configured");
  });

  test("informs when no artifacts to sync", async () => {
    project = createTestProject({
      initialized: true,
      lockfile: { version: 1, artifacts: {} },
    });

    const result = await runCli(["sync"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No artifacts installed");
  });
});
