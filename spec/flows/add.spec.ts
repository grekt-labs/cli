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

describe("grekt add", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("downloads and installs artifact from registry", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["add", "@test/artifact@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Installed");
    expect(result.stdout).toContain("@test/artifact");

    // Artifact files extracted
    const artifactDir = join(project.root, ".grekt", "artifacts", "@test", "artifact");
    expect(existsSync(artifactDir)).toBe(true);
    expect(existsSync(join(artifactDir, "skills", "test-skill.md"))).toBe(true);

    // grekt.yaml updated
    const config = parse(readFileSync(join(project.root, "grekt.yaml"), "utf-8"));
    expect(config.artifacts["@test/artifact"]).toBeDefined();

    // grekt.lock updated
    const lockfile = parse(readFileSync(join(project.root, "grekt.lock"), "utf-8"));
    expect(lockfile.artifacts["@test/artifact"]).toBeDefined();
    expect(lockfile.artifacts["@test/artifact"].version).toBe("1.0.0");
    expect(lockfile.artifacts["@test/artifact"].integrity).toBeDefined();
    expect(lockfile.artifacts["@test/artifact"].resolved).toBeDefined();
  });

  test("skips when same version already installed", async () => {
    project = createTestProject({ initialized: true });

    // First install
    await runCli(["add", "@test/artifact@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    // Second install - same version
    const result = await runCli(["add", "@test/artifact@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Already installed");
  });

  test("errors when no source provided", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["add"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Source required");
  });

  test("errors when project not initialized", async () => {
    project = createTestProject();

    const result = await runCli(["add", "@test/artifact@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not initialized");
  });

  test("errors when artifact not found in registry", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["add", "@test/nonexistent@1.0.0"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not found");
  });
});
