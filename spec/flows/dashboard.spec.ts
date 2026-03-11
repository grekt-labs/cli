import { describe, test, expect, afterEach, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";
import { startDashboardServer } from "../helpers/dashboard-server";

let dashboard: { port: number; url: string; stop: () => void; getUpsertedRegistries: () => Array<Record<string, unknown>> };

beforeAll(async () => {
  dashboard = await startDashboardServer();
});

afterAll(() => {
  dashboard?.stop();
});

function writeDashboardConfig(root: string, options: { enabled?: boolean; registries?: Record<string, Record<string, string>> }) {
  const grektDir = join(root, ".grekt");
  mkdirSync(grektDir, { recursive: true });

  const enabled = options.enabled ?? true;
  const lines = [
    "dashboard:",
    `  enabled: ${enabled}`,
    `  url: ${dashboard.url}`,
    "  email: dev@grekt.com",
    "  password: devdevdev",
  ];

  if (options.registries) {
    lines.push("");
    lines.push("registries:");
    for (const [scope, entry] of Object.entries(options.registries)) {
      lines.push(`  "${scope}":`);
      for (const [key, value] of Object.entries(entry)) {
        lines.push(`    ${key}: ${value}`);
      }
    }
  }

  writeFileSync(join(grektDir, "config.yaml"), lines.join("\n"));
}

describe("grekt dashboard sync", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("syncs registries to dashboard", async () => {
    project = createTestProject({ initialized: true });
    writeDashboardConfig(project.root, {
      registries: {
        "@company": { type: "gitlab", host: "gitlab.company.com", project: "group/artifacts" },
        "@oss": { type: "gitlab", host: "gitlab.com" },
      },
    });

    const result = await runCli(["dashboard", "sync", "registries"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Synced 2 registries to dashboard");

    const upserted = dashboard.getUpsertedRegistries();
    expect(upserted.length).toBeGreaterThanOrEqual(2);

    const scopes = upserted.map((r) => r.scope);
    expect(scopes).toContain("@company");
    expect(scopes).toContain("@oss");
  });

  test("exits early when no registries configured", async () => {
    project = createTestProject({ initialized: true });
    writeDashboardConfig(project.root, {});

    const result = await runCli(["dashboard", "sync", "registries"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No registries configured");
  });

  test("exits silently when dashboard is disabled", async () => {
    project = createTestProject({ initialized: true });
    writeDashboardConfig(project.root, {
      enabled: false,
      registries: {
        "@scope": { type: "gitlab", host: "gitlab.com" },
      },
    });

    const result = await runCli(["dashboard", "sync", "registries"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    // Should still show success message since syncToDashboard silently skips
    expect(result.stdout).toContain("Synced 1 registry to dashboard");
  });

  test("fails with unknown sync target", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["dashboard", "sync", "unknown"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown sync target");
  });

  test("fails without sync target argument", async () => {
    project = createTestProject({ initialized: true });

    const result = await runCli(["dashboard", "sync"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(1);
  });
});
