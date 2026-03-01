import { describe, test, expect, afterEach, beforeAll, afterAll } from "vitest";
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

describe("full lifecycle", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("init -> add -> list -> check -> sync -> remove -> list (empty)", async () => {
    project = createTestProject();
    const env = { GREKT_REGISTRY_URL: registry.url };

    // 1. Init
    const initResult = await runCli(["init", "-y"], { cwd: project.root });
    expect(initResult.exitCode).toBe(0);
    expect(existsSync(join(project.root, "grekt.yaml"))).toBe(true);

    // 2. Add artifact
    const addResult = await runCli(["add", "@test/artifact@1.0.0"], { cwd: project.root, env });
    expect(addResult.exitCode).toBe(0);
    expect(addResult.stdout).toContain("Installed");

    // Verify artifact is on disk
    const artifactDir = join(project.root, ".grekt", "artifacts", "@test", "artifact");
    expect(existsSync(artifactDir)).toBe(true);

    // 3. List
    const listResult = await runCli(["list"], { cwd: project.root });
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toContain("@test/artifact");
    expect(listResult.stdout).toContain("1.0.0");

    // 4. List JSON
    const listJsonResult = await runCli(["list", "--json"], { cwd: project.root });
    expect(listJsonResult.exitCode).toBe(0);
    const jsonOutput = JSON.parse(listJsonResult.stdout);
    expect(jsonOutput.artifacts["@test/artifact"]).toBeDefined();

    // 5. Check
    const checkResult = await runCli(["check"], { cwd: project.root });
    expect(checkResult.exitCode).toBe(0);

    // 6. Sync
    const syncResult = await runCli(["sync", "--force"], { cwd: project.root });
    expect(syncResult.exitCode).toBe(0);
    expect(syncResult.stdout).toContain("Sync complete");

    // 7. Remove
    const removeResult = await runCli(["remove", "@test/artifact", "--force"], { cwd: project.root });
    expect(removeResult.exitCode).toBe(0);
    expect(removeResult.stdout).toContain("Removed");

    // Verify cleanup
    expect(existsSync(artifactDir)).toBe(false);

    const config = parse(readFileSync(join(project.root, "grekt.yaml"), "utf-8"));
    expect(config.artifacts["@test/artifact"]).toBeUndefined();

    // 8. List (empty)
    const listEmptyResult = await runCli(["list"], { cwd: project.root });
    expect(listEmptyResult.exitCode).toBe(0);
    expect(listEmptyResult.stdout).toContain("No artifacts installed");
  });
});
