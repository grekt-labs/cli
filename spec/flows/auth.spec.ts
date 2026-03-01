import { describe, test, expect, afterEach } from "vitest";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";

describe("grekt auth commands", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  // ── User checks their identity ──

  describe("whoami", () => {
    test("shows 'Not logged in' when there is no session", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["whoami"], {
        cwd: project.root,
        env: {
          GREKT_SUPABASE_URL: "https://fake.supabase.co",
          GREKT_SUPABASE_ANON_KEY: "fake-anon-key",
        },
      });

      // whoami always exits 0 (informational)
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Not logged in");
    });

    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["whoami"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });

    test("shows registry URL in output", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["whoami"], {
        cwd: project.root,
        env: {
          GREKT_SUPABASE_URL: "https://my-registry.supabase.co",
          GREKT_SUPABASE_ANON_KEY: "fake-anon-key",
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("my-registry.supabase.co");
    });
  });

  // ── User attempts to log in ──

  describe("login", () => {
    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["login", "--email", "test@test.com", "--password", "pass123"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });

    test("fails when only --email is provided without --password", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["login", "--email", "test@test.com"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--email");
      expect(result.stderr).toContain("--password");
    });

    test("fails when only --password is provided without --email", async () => {
      project = createTestProject({ initialized: true });

      const result = await runCli(["login", "--password", "secret"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--email");
      expect(result.stderr).toContain("--password");
    });
  });

  // ── User attempts to log out ──

  describe("logout", () => {
    test("fails when project is not initialized", async () => {
      project = createTestProject();

      const result = await runCli(["logout"], {
        cwd: project.root,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not initialized");
    });
  });
});
