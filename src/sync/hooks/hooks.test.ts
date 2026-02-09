import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { installHooks, uninstallHooks, getHookSummary } from "./hooks";
import type { ScannedFile } from "@grekt-labs/cli-engine";

const TEST_ARTIFACT_ID = "@scope/my-artifact";

function createHookFile(overrides: Partial<{
  path: string;
  name: string;
  description: string;
  target: string;
  events: Record<string, unknown[]>;
}>): ScannedFile {
  const {
    path: filePath = "hooks/format.json",
    name = "format-on-save",
    description = "Auto-format files after edit",
    target = "claude",
    events = {
      PostToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [{ type: "command", command: "./format.sh" }],
        },
      ],
    },
  } = overrides;

  return {
    path: filePath,
    parsed: {
      frontmatter: {
        "grk-type": "hooks",
        "grk-name": name,
        "grk-description": description,
      },
      content: { target, events },
    },
  };
}

describe("hooks", () => {
  const testDir = join(process.cwd(), ".test-hooks");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("installHooks", () => {
    test("creates settings file when it does not exist", () => {
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settingsPath = join(testDir, ".claude/settings.json");
      expect(existsSync(settingsPath)).toBe(true);
    });

    test("writes hooks to correct key in settings", () => {
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.PostToolUse).toHaveLength(1);
    });

    test("rewrites relative command paths to artifact directory", () => {
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      const command = settings.hooks.PostToolUse[0].hooks[0].command;
      expect(command).toBe(".grekt/artifacts/@scope/my-artifact/hooks/format.sh");
    });

    test("preserves existing settings when adding hooks", () => {
      mkdirSync(join(testDir, ".claude"), { recursive: true });
      writeFileSync(
        join(testDir, ".claude/settings.json"),
        JSON.stringify({ permissions: { allow: ["Read"] } }, null, 2),
      );

      const hookFiles = [createHookFile({})];
      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.permissions).toEqual({ allow: ["Read"] });
      expect(settings.hooks).toBeDefined();
    });

    test("merges hooks with existing hooks in same event", () => {
      mkdirSync(join(testDir, ".claude"), { recursive: true });
      writeFileSync(
        join(testDir, ".claude/settings.json"),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              { matcher: "Bash", hooks: [{ type: "command", command: "echo existing" }] },
            ],
          },
        }, null, 2),
      );

      const hookFiles = [createHookFile({})];
      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks.PostToolUse).toHaveLength(2);
    });

    test("returns installed count and target names", () => {
      const hookFiles = [createHookFile({})];

      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.installed).toBe(1);
      expect(result.targets).toContain("Claude");
    });

    test("skips hooks with unknown target", () => {
      const hookFiles = [createHookFile({ target: "unknown-tool" })];

      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.installed).toBe(0);
      expect(existsSync(join(testDir, ".claude/settings.json"))).toBe(false);
    });

    test("handles multiple hooks for same target", () => {
      const hookFiles = [
        createHookFile({ name: "hook-1", events: {
          PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "./hook1.sh" }] }],
        }}),
        createHookFile({ path: "hooks/hook2.json", name: "hook-2", events: {
          PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./hook2.sh" }] }],
        }}),
      ];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks.PostToolUse).toHaveLength(1);
      expect(settings.hooks.PreToolUse).toHaveLength(1);
    });

    test("does not rewrite absolute command paths", () => {
      const hookFiles = [createHookFile({ events: {
        PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/usr/bin/format" }] }],
      }})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe("/usr/bin/format");
    });
  });

  describe("uninstallHooks", () => {
    test("removes hooks belonging to artifact by path", () => {
      mkdirSync(join(testDir, ".claude"), { recursive: true });
      writeFileSync(
        join(testDir, ".claude/settings.json"),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              {
                matcher: "Edit",
                hooks: [{ type: "command", command: ".grekt/artifacts/@scope/my-artifact/hooks/format.sh" }],
              },
              {
                matcher: "Bash",
                hooks: [{ type: "command", command: "echo other" }],
              },
            ],
          },
        }, null, 2),
      );

      const removed = uninstallHooks(testDir, TEST_ARTIFACT_ID);

      expect(removed).toBe(1);
      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks.PostToolUse).toHaveLength(1);
      expect(settings.hooks.PostToolUse[0].matcher).toBe("Bash");
    });

    test("removes entire hooks key when no hooks remain", () => {
      mkdirSync(join(testDir, ".claude"), { recursive: true });
      writeFileSync(
        join(testDir, ".claude/settings.json"),
        JSON.stringify({
          permissions: { allow: ["Read"] },
          hooks: {
            PostToolUse: [
              {
                matcher: "Edit",
                hooks: [{ type: "command", command: ".grekt/artifacts/@scope/my-artifact/hooks/format.sh" }],
              },
            ],
          },
        }, null, 2),
      );

      uninstallHooks(testDir, TEST_ARTIFACT_ID);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks).toBeUndefined();
      expect(settings.permissions).toEqual({ allow: ["Read"] });
    });

    test("returns 0 when artifact has no hooks installed", () => {
      mkdirSync(join(testDir, ".claude"), { recursive: true });
      writeFileSync(
        join(testDir, ".claude/settings.json"),
        JSON.stringify({ hooks: {} }, null, 2),
      );

      const removed = uninstallHooks(testDir, "@scope/other-artifact");

      expect(removed).toBe(0);
    });

    test("handles missing settings file gracefully", () => {
      const removed = uninstallHooks(testDir, TEST_ARTIFACT_ID);
      expect(removed).toBe(0);
    });
  });

  describe("getHookSummary", () => {
    test("groups descriptions by target", () => {
      const hookFiles = [
        createHookFile({ name: "hook-1", description: "Format files", events: { PostToolUse: [] } }),
        createHookFile({ name: "hook-2", description: "Lint code", events: { PreToolUse: [] } }),
      ];

      const summary = getHookSummary(hookFiles);

      expect(summary.get("Claude")).toHaveLength(2);
      expect(summary.get("Claude")![0]).toContain("Format files");
      expect(summary.get("Claude")![1]).toContain("Lint code");
    });
  });
});
