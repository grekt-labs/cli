import { describe, test, expect, mock } from "bun:test";
import { syncToTargets } from "./helpers";
import type { Lockfile, ProjectConfig } from "@grekt-labs/cli-engine";

function createConfig(targets: string[] = []): ProjectConfig {
  return {
    artifacts: {},
    targets,
    customTargets: {},
  } as unknown as ProjectConfig;
}

function createLockfile(): Lockfile {
  return { artifacts: {} } as unknown as Lockfile;
}

describe("syncToTargets", () => {
  test("does nothing when no targets configured", async () => {
    // Should return immediately without calling any plugins
    await syncToTargets(createConfig([]), createLockfile(), "/root");
  });

  test("throws for unknown target", async () => {
    expect(
      syncToTargets(createConfig(["nonexistent-target-xyz"]), createLockfile(), "/root")
    ).rejects.toThrow(/Unknown sync target/);
  });
});
