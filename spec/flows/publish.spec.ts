import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt publish", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── Author tries to publish without proper artifact structure ──

  describe("artifact validation pipeline", () => {
    test("fails when directory has no grekt.yaml", async () => {
      project = createTestProject({ initialized: true });
      const emptyDir = join(project.root, "no-manifest");
      mkdirSync(emptyDir, { recursive: true });

      const result = await runCli(["publish", emptyDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
    });

    test("fails when artifact has no scope in name", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = join(project.root, "no-scope");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        [
          "name: my-artifact",
          "version: 1.0.0",
          "description: Missing scope",
          "keywords:",
          "  - test",
          "  - scope",
          "  - missing",
        ].join("\n")
      );

      writeFileSync(
        join(artifactDir, "skills", "skill.md"),
        [
          "---",
          "grk-type: skills",
          "grk-name: skill",
          "grk-description: A skill",
          "---",
          "",
          "# Skill",
        ].join("\n")
      );

      const result = await runCli(["publish", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      // Should show guidance about adding a scope
      expect(result.stdout).toContain("@");
    });

    test("fails when artifact has no components (no .md files with frontmatter)", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = join(project.root, "no-components");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        [
          'name: "@test/no-components"',
          "version: 1.0.0",
          "description: No components here",
          "keywords:",
          "  - test",
          "  - empty",
          "  - void",
        ].join("\n")
      );

      // Write a plain .md file without grk-type frontmatter
      writeFileSync(
        join(artifactDir, "skills", "readme.md"),
        "# Just a readme\n\nNo frontmatter here."
      );

      const result = await runCli(["publish", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("component");
    });

    test("fails when artifact has insufficient keywords", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = join(project.root, "few-keywords");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        [
          'name: "@test/few-keywords"',
          "version: 1.0.0",
          "description: Too few keywords",
          "keywords:",
          "  - only-one",
        ].join("\n")
      );

      writeFileSync(
        join(artifactDir, "skills", "skill.md"),
        [
          "---",
          "grk-type: skills",
          "grk-name: skill",
          "grk-description: A skill",
          "---",
          "",
          "# Skill",
        ].join("\n")
      );

      const result = await runCli(["publish", artifactDir], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("keyword");
    });
  });

  // ── Author is not authenticated ──

  describe("authentication failures", () => {
    function createValidArtifact(root: string): string {
      const artifactDir = join(root, "valid-artifact");
      mkdirSync(join(artifactDir, "skills"), { recursive: true });

      writeFileSync(
        join(artifactDir, "grekt.yaml"),
        [
          'name: "@test/valid"',
          "version: 1.0.0",
          "description: A valid artifact",
          "keywords:",
          "  - test",
          "  - valid",
          "  - artifact",
        ].join("\n")
      );

      writeFileSync(
        join(artifactDir, "skills", "my-skill.md"),
        [
          "---",
          "grk-type: skills",
          "grk-name: my-skill",
          "grk-description: Does things",
          "---",
          "",
          "# My Skill",
        ].join("\n")
      );

      return artifactDir;
    }

    test("API publish fails when not logged in", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = createValidArtifact(project.root);

      const result = await runCli(["publish", artifactDir], {
        cwd: project.root,
        env: {
          // Ensure no auth tokens leak from host environment
          GREKT_TOKEN: "",
          GREKT_SUPABASE_URL: "https://fake.supabase.co",
          GREKT_SUPABASE_ANON_KEY: "fake-anon-key",
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/not authenticated|not logged|authentication/i);
    });

    test("S3 publish fails when no credentials configured", async () => {
      project = createTestProject({ initialized: true });
      const artifactDir = createValidArtifact(project.root);

      const result = await runCli(["publish", "--s3", artifactDir], {
        cwd: project.root,
        env: {
          // Clear all S3 env vars
          GREKT_STORAGE_ENDPOINT: "",
          GREKT_STORAGE_ACCESS_KEY_ID: "",
          GREKT_STORAGE_SECRET_ACCESS_KEY: "",
          GREKT_STORAGE_BUCKET: "",
          STORAGE_ENDPOINT: "",
          STORAGE_ACCESS_KEY_ID: "",
          STORAGE_SECRET_ACCESS_KEY: "",
          STORAGE_BUCKET: "",
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("S3 credentials");
    });
  });
});
