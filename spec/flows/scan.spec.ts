import { describe, test, expect, afterEach, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync } from "fs";
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

describe("grekt scan", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("fails when project is not initialized and no argument given", async () => {
    project = createTestProject();

    const result = await runCli(["scan"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not initialized");
  });

  test("scans all installed artifacts in initialized project", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["scan", "--json"], { cwd: project.root });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("@test/artifact");
    expect(output["@test/artifact"]).toHaveProperty("score");
    expect(output["@test/artifact"]).toHaveProperty("badge");
  });

  test("scans local path without requiring init", async () => {
    project = createTestProject();

    const localArtifact = join(project.root, "my-artifact");
    mkdirSync(join(localArtifact, "skills"), { recursive: true });
    writeFileSync(join(localArtifact, "grekt.yaml"), "name: local-test\nversion: 1.0.0\n");
    writeFileSync(join(localArtifact, "skills", "example.md"), "# Example skill\nSome content here.\n");

    const result = await runCli(["scan", "./my-artifact", "--json"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("score");
    expect(output).toHaveProperty("badge");
  });

  test("scans remote artifact without requiring init", async () => {
    project = createTestProject();

    const result = await runCli(["scan", "@test/artifact@1.0.0", "--json"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("score");
    expect(output).toHaveProperty("badge");
  });
});
