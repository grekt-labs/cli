import { describe, test, expect, afterEach, beforeAll, afterAll } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { rmSync } from "fs";
import { parse, stringify } from "yaml";
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

/**
 * The install command uses `resolved` URL directly via downloadAndExtractTarball,
 * which has SSRF protection that blocks localhost. For E2E tests with a local mock
 * server, we clear `resolved` so install falls back to the source-based path
 * (which goes through the registry API client and respects GREKT_REGISTRY_URL).
 */
function clearResolvedUrls(projectRoot: string): void {
  const lockfilePath = join(projectRoot, "grekt.lock");
  const lockfile = parse(readFileSync(lockfilePath, "utf-8"));
  for (const entry of Object.values(lockfile.artifacts) as Record<string, unknown>[]) {
    delete entry.resolved;
  }
  writeFileSync(lockfilePath, stringify(lockfile));
}

describe("grekt install", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("installs all artifacts from lockfile", async () => {
    project = await projectWithArtifact();

    // Remove artifacts dir to simulate fresh clone
    const artifactsDir = join(project.root, ".grekt", "artifacts");
    rmSync(artifactsDir, { recursive: true, force: true });

    // Clear resolved URLs so install uses source-based fallback (avoids SSRF block on localhost)
    clearResolvedUrls(project.root);

    const result = await runCli(["install"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Installed");

    // Artifact restored
    const artifactDir = join(project.root, ".grekt", "artifacts", "@test", "artifact");
    expect(existsSync(artifactDir)).toBe(true);
    expect(existsSync(join(artifactDir, "skills", "test-skill.md"))).toBe(true);
  });

  test("skips already installed artifacts", async () => {
    project = await projectWithArtifact();

    const result = await runCli(["install"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("skip");
    expect(result.stdout).toContain("already installed");
  });

  test("reinstalls with --force flag", async () => {
    project = await projectWithArtifact();
    clearResolvedUrls(project.root);

    const result = await runCli(["install", "--force"], {
      cwd: project.root,
      env: { GREKT_REGISTRY_URL: registry.url },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Installed");
  });

  test("errors when lockfile missing", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["install"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("No artifacts to install");
  });

  test("handles empty lockfile gracefully", async () => {
    project = createTestProject({
      initialized: true,
      lockfile: { version: 1, artifacts: {} },
    });

    const result = await runCli(["install"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No artifacts in lockfile");
  });

  test("errors when not initialized", async () => {
    project = createTestProject();

    const result = await runCli(["install"], { cwd: project.root });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not initialized");
  });
});
