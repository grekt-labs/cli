import { describe, test, expect, afterEach } from "vitest";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt deprecate / undeprecate", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── Author tries to deprecate without proper arguments ──

  describe("deprecate input validation", () => {
    test("fails with usage hint when no arguments provided", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["deprecate"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Artifact and version required");
      expect(result.stdout).toContain("grekt deprecate @author/name@1.0.0");
    });

    test("fails when version is missing from argument", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["deprecate", "@author/name"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid format");
    });

    test("fails when format is completely wrong", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["deprecate", "just-a-name"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid format");
    });

    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["deprecate", "@author/name@1.0.0"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });
  });

  // ── Author tries to deprecate without credentials ──

  describe("deprecate authentication", () => {
    test("API mode fails when not logged in", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["deprecate", "@author/name@1.0.0"], {
        cwd: project.root,
        env: {
          GREKT_SUPABASE_URL: "https://fake.supabase.co",
          GREKT_SUPABASE_ANON_KEY: "fake-anon-key",
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Not logged in");
      expect(result.stdout).toContain("grekt login");
    });

    test("S3 mode fails when no credentials configured", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["deprecate", "--s3", "@author/name@1.0.0"], {
        cwd: project.root,
        env: {
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

  // ── Author tries to undeprecate without proper arguments ──

  describe("undeprecate input validation", () => {
    test("fails with usage hint when no arguments provided", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["undeprecate"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Artifact and version required");
      expect(result.stdout).toContain("grekt undeprecate @author/name@1.0.0");
    });

    test("fails when version is missing from argument", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["undeprecate", "@author/name"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid format");
    });

    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["undeprecate", "@author/name@1.0.0"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });
  });

  // ── Undeprecate authentication ──

  describe("undeprecate authentication", () => {
    test("API mode fails when not logged in", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["undeprecate", "@author/name@1.0.0"], {
        cwd: project.root,
        env: {
          GREKT_SUPABASE_URL: "https://fake.supabase.co",
          GREKT_SUPABASE_ANON_KEY: "fake-anon-key",
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Not logged in");
    });

    test("S3 mode fails when no credentials configured", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["undeprecate", "--s3", "@author/name@1.0.0"], {
        cwd: project.root,
        env: {
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
