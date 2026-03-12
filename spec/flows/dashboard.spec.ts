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

function writeDashboardConfig(root: string, options: { registries?: Record<string, Record<string, string>> }) {
  const grektDir = join(root, ".grekt");
  mkdirSync(grektDir, { recursive: true });

  const lines = [
    "dashboard:",
    `  url: ${dashboard.url}`,
    "  token: gdk_test-token-e2e",
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
        "@oss": { type: "gitlab", host: "gitlab.com", project: "open/artifacts" },
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

  test("skips silently when no dashboard config exists", async () => {
    project = createTestProject({ initialized: true });

    // Write config without dashboard block
    const grektDir = join(project.root, ".grekt");
    mkdirSync(grektDir, { recursive: true });
    writeFileSync(join(grektDir, "config.yaml"), [
      "registries:",
      '  "@scope":',
      "    type: gitlab",
      "    host: gitlab.com",
    ].join("\n"));

    const result = await runCli(["dashboard", "sync", "registries"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    // syncToDashboard silently skips when no dashboard config — no success message
    expect(result.stdout).not.toContain("Synced");
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
