import { describe, test, expect, afterEach, beforeAll, afterAll } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
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

describe("grekt remove", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("removes installed artifact with --force", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["remove", "@test/artifact", "--force"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Removed");

    // Artifact directory deleted
    const artifactDir = join(project.root, ".grekt", "artifacts", "@test", "artifact");
    expect(existsSync(artifactDir)).toBe(false);

    // Config cleaned
    const config = parse(readFileSync(join(project.root, "grekt.yaml"), "utf-8"));
    expect(config.artifacts["@test/artifact"]).toBeUndefined();

    // Lockfile cleaned
    const lockfile = parse(readFileSync(join(project.root, "grekt.lock"), "utf-8"));
    expect(lockfile.artifacts["@test/artifact"]).toBeUndefined();
  });

  test("works with rm alias", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["rm", "@test/artifact", "--force"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Removed");
  });

  test("errors when artifact not installed", async () => {
    project = createTestProject({
      initialized: true,
      lockfile: { version: 1, artifacts: {} },
    });

    const result = await runCli(["remove", "test/nonexistent", "--force"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not installed");
  });

  test("errors when no artifact ID provided", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["remove"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Artifact ID required");
  });

  test("errors when not initialized", async () => {
    project = createTestProject();

    const result = await runCli(["remove", "@test/artifact", "--force"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
  });
});
