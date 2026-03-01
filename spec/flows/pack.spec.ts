import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt pack", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── Author packs a valid artifact for distribution ──

  describe("author packs a valid artifact", () => {
    function createPublishableArtifact(root: string): string {
      const artifactDir = join(root, "my-artifact");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        [
          'name: "@test/my-artifact"',
          "version: 1.0.0",
          "description: A test artifact",
          "keywords:",
          "  - test",
          "  - automation",
          "  - tooling",
        ].join("\n")
      );

      writeFileSync(
        join(artifactDir, "skills", "do-stuff.md"),
        [
          "---",
          "grk-type: skills",
          "grk-name: do-stuff",
          "grk-description: Does stuff",
          "---",
          "",
          "# Do Stuff",
          "",
          "Instructions for doing stuff.",
        ].join("\n")
      );

      return artifactDir;
    }

    test("creates tarball and shows component summary", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = createPublishableArtifact(project.root);

      const result = await runCli(["pack", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Packing");
      expect(result.stdout).toContain("@test/my-artifact");
      expect(result.stdout).toContain("1.0.0");
      expect(result.stdout).toContain("Created");
      expect(result.stdout).toContain(".tar.gz");
    });

    test("includes component count in summary", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = createPublishableArtifact(project.root);

      // Add a second skill
      writeFileSync(
        join(artifactDir, "skills", "another-skill.md"),
        [
          "---",
          "grk-type: skills",
          "grk-name: another-skill",
          "grk-description: Another skill",
          "---",
          "",
          "# Another Skill",
        ].join("\n")
      );

      const result = await runCli(["pack", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("skill(s)");
    });
  });

  // ── Author tries to pack a directory without manifest ──

  describe("artifact with missing manifest", () => {
    test("fails when directory has no grekt.yaml", async () => {
      project = createTestProject({ initialized: true });
      const emptyDir = join(project.root, "no-manifest");
      mkdirSync(emptyDir, { recursive: true });

      const result = await runCli(["pack", emptyDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
    });

    test("fails when path does not exist", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["pack", "/tmp/nonexistent-path-12345"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
    });
  });

  // ── Author tries to pack artifact without publishable fields ──

  describe("artifact missing required fields", () => {
    test("fails when grekt.yaml has no name or version", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = join(project.root, "bad-artifact");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        ["targets:", "  - claude"].join("\n")
      );

      const result = await runCli(["pack", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
    });

    test("fails when artifact has no components (empty skills/)", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = join(project.root, "no-components");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        [
          'name: "@test/empty"',
          "version: 1.0.0",
          "description: Empty artifact",
          "keywords:",
          "  - test",
          "  - empty",
          "  - void",
        ].join("\n")
      );

      // No .md files with frontmatter in skills/

      const result = await runCli(["pack", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
    });
  });
});
