import { describe, test, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt init", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("creates grekt.yaml with default targets", async () => {
    project = createTestProject();

    const result = await runCli(["init", "-y"], { cwd: project.root });

    expect(result.exitCode).toBe(0);

    // grekt.yaml exists with correct content
    const configPath = join(project.root, "grekt.yaml");
    expect(existsSync(configPath)).toBe(true);

    const config = parse(readFileSync(configPath, "utf-8"));
    expect(config.targets).toEqual(["claude"]);

    // .grekt directory structure
    expect(existsSync(join(project.root, ".grekt"))).toBe(true);
    expect(existsSync(join(project.root, ".grekt", "index"))).toBe(true);
    expect(existsSync(join(project.root, ".grekt", "artifacts"))).toBe(true);
  });

  test("warns when already initialized", async () => {
    project = createTestProject({ initialized: true });

    const configBefore = readFileSync(join(project.root, "grekt.yaml"), "utf-8");

    const result = await runCli(["init", "-y"], { cwd: project.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("already initialized");

    // Config unchanged
    const configAfter = readFileSync(join(project.root, "grekt.yaml"), "utf-8");
    expect(configAfter).toBe(configBefore);
  });

  test("creates necessary subdirectories", async () => {
    project = createTestProject();

    await runCli(["init", "-y"], { cwd: project.root });

    expect(existsSync(join(project.root, ".grekt", "artifacts"))).toBe(true);
  });
});
