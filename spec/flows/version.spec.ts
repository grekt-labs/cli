import { describe, test, expect, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

function createArtifactManifest(dir: string, name: string, version: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "grekt.yaml"),
    [
      `name: "${name}"`,
      `version: "${version}"`,
      `description: "Test artifact"`,
      "keywords:",
      "  - test",
      "  - automation",
      "  - tooling",
    ].join("\n")
  );
}

describe("grekt version", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── Author bumps versions before a release ──

  describe("standard version bumps", () => {
    test("bumps patch version (1.0.0 -> 1.0.1)", async () => {
      project = createTestProject();
      createArtifactManifest(join(project.root, "my-artifact"), "@test/bump", "1.0.0");

      const result = await runCli(["version", "patch", join(project.root, "my-artifact")], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1.0.0");
      expect(result.stdout).toContain("1.0.1");
      expect(result.stdout).toContain("Updated");

      const manifest = readFileSync(join(project.root, "my-artifact", "grekt.yaml"), "utf-8");
      expect(manifest).toContain("1.0.1");
      expect(manifest).not.toContain('"1.0.0"');
    });

    test("bumps minor version (1.2.3 -> 1.3.0)", async () => {
      project = createTestProject();
      createArtifactManifest(join(project.root, "my-artifact"), "@test/bump", "1.2.3");

      const result = await runCli(["version", "minor", join(project.root, "my-artifact")], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1.3.0");

      const manifest = readFileSync(join(project.root, "my-artifact", "grekt.yaml"), "utf-8");
      expect(manifest).toContain("1.3.0");
    });

    test("bumps major version (1.2.3 -> 2.0.0)", async () => {
      project = createTestProject();
      createArtifactManifest(join(project.root, "my-artifact"), "@test/bump", "1.2.3");

      const result = await runCli(["version", "major", join(project.root, "my-artifact")], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("2.0.0");

      const manifest = readFileSync(join(project.root, "my-artifact", "grekt.yaml"), "utf-8");
      expect(manifest).toContain("2.0.0");
    });
  });

  // ── Author previews changes before committing ──

  describe("dry-run mode", () => {
    test("shows what would change without modifying files", async () => {
      project = createTestProject();
      createArtifactManifest(join(project.root, "my-artifact"), "@test/preview", "2.0.0");

      const result = await runCli(["version", "patch", join(project.root, "my-artifact"), "--dry-run"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("2.0.0");
      expect(result.stdout).toContain("2.0.1");
      expect(result.stdout).toMatch(/dry.run/i);

      // File should NOT be modified
      const manifest = readFileSync(join(project.root, "my-artifact", "grekt.yaml"), "utf-8");
      expect(manifest).toContain('"2.0.0"');
      expect(manifest).not.toContain("2.0.1");
    });
  });

  // ── Author makes mistakes with version command ──

  describe("validation errors", () => {
    test("fails when no bump type provided", async () => {
      project = createTestProject();
      createArtifactManifest(project.root, "@test/no-bump", "1.0.0");

      const result = await runCli(["version"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Bump type required");
    });

    test("fails with invalid bump type", async () => {
      project = createTestProject();
      createArtifactManifest(project.root, "@test/invalid", "1.0.0");

      const result = await runCli(["version", "supermajor"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid bump type");
      expect(result.stderr).toContain("supermajor");
    });

    test("prerelease fails without --beta flag", async () => {
      project = createTestProject();
      createArtifactManifest(project.root, "@test/pre", "1.0.0");

      const result = await runCli(["version", "prerelease"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--beta");
    });

    test("fails when directory has no grekt.yaml", async () => {
      project = createTestProject();
      const emptyDir = join(project.root, "empty");
      mkdirSync(emptyDir, { recursive: true });

      const result = await runCli(["version", "patch", emptyDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No artifacts found");
    });

    test("fails when grekt.yaml is not a publishable manifest (missing name/version)", async () => {
      project = createTestProject();
      const dir = join(project.root, "not-publishable");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "grekt.yaml"),
        ["targets:", "  - claude"].join("\n")
      );

      const result = await runCli(["version", "patch", dir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Cannot bump version");
    });
  });

  // ── Author bumps multiple artifacts at once ──

  describe("multi-artifact directory scan", () => {
    test("bumps all artifacts found in subdirectories", async () => {
      project = createTestProject();

      createArtifactManifest(join(project.root, "artifact-a"), "@test/a", "1.0.0");
      createArtifactManifest(join(project.root, "artifact-b"), "@test/b", "2.0.0");

      const result = await runCli(["version", "minor", project.root], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Found 2 artifact(s)");
      expect(result.stdout).toContain("Updated 2 artifact(s)");

      const manifestA = readFileSync(join(project.root, "artifact-a", "grekt.yaml"), "utf-8");
      const manifestB = readFileSync(join(project.root, "artifact-b", "grekt.yaml"), "utf-8");

      expect(manifestA).toContain("1.1.0");
      expect(manifestB).toContain("2.1.0");
    });

    test("dry-run on multiple artifacts shows all changes without modifying", async () => {
      project = createTestProject();

      createArtifactManifest(join(project.root, "artifact-a"), "@test/a", "1.0.0");
      createArtifactManifest(join(project.root, "artifact-b"), "@test/b", "3.5.2");

      const result = await runCli(["version", "major", project.root, "--dry-run"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("2.0.0");
      expect(result.stdout).toContain("4.0.0");

      // Files unchanged
      const manifestA = readFileSync(join(project.root, "artifact-a", "grekt.yaml"), "utf-8");
      expect(manifestA).toContain('"1.0.0"');
    });
  });
});
