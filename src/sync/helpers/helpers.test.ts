import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { runSync, syncToTargets } from "./helpers";
import type { SyncPlugin, SyncResult, Lockfile, ProjectConfig } from "@grekt/engine";
import { suppressConsole } from "#/test-utils";

let restoreConsole: () => void;

beforeEach(() => {
  restoreConsole = suppressConsole("log");
});

afterEach(() => {
  restoreConsole();
});

function createMockPlugin(overrides: Partial<SyncPlugin> = {}): SyncPlugin {
  return {
    id: "mock",
    name: "Mock",
    targetFile: ".mock",
    targetExists: () => true,
    sync: async () => ({ created: [], updated: [], skipped: [], syncedFiles: {} }),
    preview: () => ({ willCreate: [], willUpdate: [], willSkip: [] }),
    ...overrides,
  };
}

const baseLockfile: Lockfile = {
  version: 1,
  artifacts: {
    "@scope/test": {
      version: "1.0.0",
      integrity: "sha256:abc",
      files: {},
    },
  },
};

const baseConfig: ProjectConfig = {
  targets: ["mock"],
  artifacts: { "@scope/test": "1.0.0" },
  customTargets: {},
};

describe("helpers", () => {
  describe("runSync", () => {
    test("returns correct counts for created/updated/skipped", async () => {
      const syncResult: SyncResult = {
        created: ["file1.md", "file2.md"],
        updated: ["file3.md"],
        skipped: ["file4.md"],
        syncedFiles: {},
      };

      const plugin = createMockPlugin({ sync: async () => syncResult });

      const result = await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        resolvePlugin: () => plugin,
      });

      expect(result.totalCreated).toBe(2);
      expect(result.totalUpdated).toBe(1);
      expect(result.totalSkipped).toBe(1);
    });

    test("accumulates counts across multiple targets", async () => {
      const plugins: Record<string, SyncPlugin> = {
        p1: createMockPlugin({
          id: "p1",
          sync: async () => ({ created: ["a.md"], updated: [], skipped: [], syncedFiles: {} }),
        }),
        p2: createMockPlugin({
          id: "p2",
          sync: async () => ({ created: ["b.md"], updated: ["c.md"], skipped: [], syncedFiles: {} }),
        }),
      };

      const result = await runSync({
        targets: ["p1", "p2"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        resolvePlugin: (target) => plugins[target],
      });

      expect(result.totalCreated).toBe(2);
      expect(result.totalUpdated).toBe(1);
      expect(result.totalSkipped).toBe(0);
    });

    test("skips targets when createTarget is false and target does not exist", async () => {
      const syncFn = vi.fn(async () => ({ created: [], updated: [], skipped: [], syncedFiles: {} }));
      const plugin = createMockPlugin({ targetExists: () => false, sync: syncFn });

      const result = await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        createTarget: false,
        resolvePlugin: () => plugin,
      });

      expect(syncFn).not.toHaveBeenCalled();
      expect(result.totalCreated).toBe(0);
    });

    test("creates target when createTarget is true and target does not exist", async () => {
      const syncFn = vi.fn(async () => ({ created: ["new.md"], updated: [], skipped: [], syncedFiles: {} }));
      const plugin = createMockPlugin({ targetExists: () => false, sync: syncFn });

      const result = await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        createTarget: true,
        resolvePlugin: () => plugin,
      });

      expect(syncFn).toHaveBeenCalledTimes(1);
      expect(result.totalCreated).toBe(1);
    });

    test("passes force option to plugin sync", async () => {
      const syncFn = vi.fn(async () => ({ created: [], updated: [], skipped: [], syncedFiles: {} }));
      const plugin = createMockPlugin({ sync: syncFn });

      await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        force: true,
        resolvePlugin: () => plugin,
      });

      const callArgs = syncFn.mock.calls[0];
      expect(callArgs[2].force).toBe(true);
    });

    test("counts lazy mode items separately from regular skipped", async () => {
      const syncResult: SyncResult = {
        created: [],
        updated: [],
        skipped: [
          "@obra/superpowers (lazy mode)",
          "@scope/broken (invalid artifact)",
          "@other/pkg (lazy mode)",
        ],
        syncedFiles: {},
      };

      const plugin = createMockPlugin({ sync: async () => syncResult });

      const result = await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        resolvePlugin: () => plugin,
      });

      expect(result.totalSkipped).toBe(3);
    });

    test("counts only lazy mode items in totalSkipped", async () => {
      const syncResult: SyncResult = {
        created: [],
        updated: [],
        skipped: ["@obra/superpowers (lazy mode)"],
        syncedFiles: {},
      };

      const plugin = createMockPlugin({ sync: async () => syncResult });

      const result = await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        resolvePlugin: () => plugin,
      });

      expect(result.totalSkipped).toBe(1);
    });

    test("counts mixed lazy and non-lazy skipped items correctly", async () => {
      const syncResult: SyncResult = {
        created: ["file1.md"],
        updated: [],
        skipped: [
          "@lazy/pkg (lazy mode)",
          "@broken/pkg (invalid artifact)",
        ],
        syncedFiles: {},
      };

      const plugin = createMockPlugin({ sync: async () => syncResult });

      const result = await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        resolvePlugin: () => plugin,
      });

      expect(result.totalCreated).toBe(1);
      expect(result.totalSkipped).toBe(2);
    });

    test("returns zero counts for empty targets", async () => {
      const result = await runSync({
        targets: [],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
      });

      expect(result.totalCreated).toBe(0);
      expect(result.totalUpdated).toBe(0);
      expect(result.totalSkipped).toBe(0);
    });

    test("passes createTarget=true to plugin when target does not exist", async () => {
      const syncFn = vi.fn(async () => ({ created: [], updated: [], skipped: [], syncedFiles: {} }));
      const plugin = createMockPlugin({ targetExists: () => false, sync: syncFn });

      await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        createTarget: true,
        resolvePlugin: () => plugin,
      });

      const callArgs = syncFn.mock.calls[0];
      expect(callArgs[2].createTarget).toBe(true);
    });

    test("passes createTarget=false to plugin when target already exists", async () => {
      const syncFn = vi.fn(async () => ({ created: [], updated: [], skipped: [], syncedFiles: {} }));
      const plugin = createMockPlugin({ targetExists: () => true, sync: syncFn });

      await runSync({
        targets: ["mock"],
        lockfile: baseLockfile,
        projectRoot: "/tmp/test",
        projectConfig: baseConfig,
        resolvePlugin: () => plugin,
      });

      const callArgs = syncFn.mock.calls[0];
      expect(callArgs[2].createTarget).toBe(false);
    });
  });

  describe("syncToTargets", () => {
    test("returns without error when no targets configured", async () => {
      const config: ProjectConfig = {
        targets: [],
        artifacts: {},
        customTargets: {},
      };

      const result = await syncToTargets(config, baseLockfile, "/tmp/test");
      expect(result).toBeUndefined();
    });
  });
});
