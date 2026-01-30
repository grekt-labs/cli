import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { stringify } from "yaml";
import { runCheck } from "./check";
import type { Lockfile } from "@grekt-labs/cli-engine";

const LOCKFILE_NAME = "grekt.lock";
const ARTIFACTS_DIR = ".grekt/artifacts";

describe("runCheck", () => {
  const testDir = join(process.cwd(), ".test-check");
  const artifactsPath = join(testDir, ARTIFACTS_DIR);

  function writeLockfile(lockfile: Lockfile): void {
    writeFileSync(join(testDir, LOCKFILE_NAME), stringify(lockfile));
  }

  function createArtifact(artifactId: string, files: Record<string, string>): void {
    const artifactDir = join(artifactsPath, artifactId);
    mkdirSync(artifactDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const filePath = join(artifactDir, name);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, content);
    }
  }

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(artifactsPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("returns healthy when all artifacts present", () => {
    createArtifact("@scope/artifact", { "agent.md": "# Agent" });
    writeLockfile({
      version: 1,
      artifacts: {
        "@scope/artifact": {
          version: "1.0.0",
          integrity: "sha256:abc",
          files: {},
          skills: [],
          commands: [],
        },
      },
    });

    const summary = runCheck(testDir);

    expect(summary.healthy).toBe(true);
    expect(summary.okCount).toBe(1);
  });

  test("detects missing artifact directory", () => {
    writeLockfile({
      version: 1,
      artifacts: {
        "@scope/missing": {
          version: "1.0.0",
          integrity: "sha256:abc",
          files: {},
          skills: [],
          commands: [],
        },
      },
    });

    const summary = runCheck(testDir);

    expect(summary.healthy).toBe(false);
    expect(summary.missingCount).toBe(1);
    expect(summary.results[0].status).toBe("missing");
  });

  test("detects file hash mismatch (drift)", () => {
    createArtifact("@scope/artifact", { "agent.md": "# Modified" });
    writeLockfile({
      version: 1,
      artifacts: {
        "@scope/artifact": {
          version: "1.0.0",
          integrity: "sha256:original",
          files: { "agent.md": "sha256:wrong-hash" },
          skills: [],
          commands: [],
        },
      },
    });

    const summary = runCheck(testDir);

    expect(summary.healthy).toBe(false);
    expect(summary.driftCount).toBe(1);
    expect(summary.results[0].status).toBe("drift");
  });

  test("detects skill filename collisions between artifacts", () => {
    createArtifact("@org/a", { "skills/shared.md": "# A" });
    createArtifact("@org/b", { "skills/shared.md": "# B" });
    writeLockfile({
      version: 1,
      artifacts: {
        "@org/a": {
          version: "1.0.0",
          integrity: "sha256:a",
          files: {},
          agents: [],
          skills: ["skills/shared.md"],
          commands: [],
          mcps: [],
          rules: [],
        },
        "@org/b": {
          version: "1.0.0",
          integrity: "sha256:b",
          files: {},
          agents: [],
          skills: ["skills/shared.md"],
          commands: [],
          mcps: [],
          rules: [],
        },
      },
    });

    const summary = runCheck(testDir);

    expect(summary.collisions.length).toBeGreaterThan(0);
    expect(summary.collisions[0].filename).toBe("shared.md");
    expect(summary.collisions[0].category).toBe("skills");
  });

  test("calculates total size of all artifacts", () => {
    const content = "x".repeat(100);
    createArtifact("@scope/artifact", { "file.md": content });
    writeLockfile({
      version: 1,
      artifacts: {
        "@scope/artifact": {
          version: "1.0.0",
          integrity: "sha256:abc",
          files: {},
          skills: [],
          commands: [],
        },
      },
    });

    const summary = runCheck(testDir);

    expect(summary.totalSize).toBeGreaterThanOrEqual(100);
  });

  test("returns empty healthy summary with no artifacts", () => {
    writeLockfile({ version: 1, artifacts: {} });

    const summary = runCheck(testDir);

    expect(summary.healthy).toBe(true);
    expect(summary.results).toHaveLength(0);
  });

  test("handles multiple artifacts with mixed statuses", () => {
    createArtifact("@scope/ok", { "agent.md": "# OK" });
    // @scope/missing not created
    writeLockfile({
      version: 1,
      artifacts: {
        "@scope/ok": {
          version: "1.0.0",
          integrity: "sha256:abc",
          files: {},
          skills: [],
          commands: [],
        },
        "@scope/missing": {
          version: "1.0.0",
          integrity: "sha256:xyz",
          files: {},
          skills: [],
          commands: [],
        },
      },
    });

    const summary = runCheck(testDir);

    expect(summary.healthy).toBe(false);
    expect(summary.okCount).toBe(1);
    expect(summary.missingCount).toBe(1);
  });
});
