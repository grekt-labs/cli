import { describe, test, expect, afterEach, beforeAll, afterAll } from "vitest";
import { writeFileSync, rmSync } from "fs";
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

describe("grekt check", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("reports healthy when all artifacts intact", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["check"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("healthy");
  });

  test("detects file modification (drift)", async () => {
    project = await projectWithArtifact();

    // Modify a file to cause drift
    const skillPath = join(project.root, ".grekt", "artifacts", "@test", "artifact", "skills", "test-skill.md");
    writeFileSync(skillPath, "modified content that breaks integrity");

    const result = await runCli(["check"], { cwd: project.root });

    expect(result.stdout).toContain("@test/artifact");
    expect(result.stdout).toMatch(/drift|modified|mismatch/i);
  });

  test("detects missing artifact directory", async () => {
    project = await projectWithArtifact();

    // Remove the artifact directory but keep lockfile
    const artifactDir = join(project.root, ".grekt", "artifacts", "@test", "artifact");
    rmSync(artifactDir, { recursive: true, force: true });

    const result = await runCli(["check"], { cwd: project.root });

    expect(result.stdout).toContain("@test/artifact");
    expect(result.stdout).toMatch(/missing/i);
  });

  test("handles no artifacts gracefully", async () => {
    project = createTestProject({
      initialized: true,
      lockfile: { version: 1, artifacts: {} },
    });

    const result = await runCli(["check"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No artifacts installed");
  });
});
