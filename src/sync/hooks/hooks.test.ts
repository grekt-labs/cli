import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { installHooks, uninstallHooks, getHookSummary } from "./hooks";
import type { ScannedFile } from "@grekt/engine";

const TEST_ARTIFACT_ID = "@scope/my-artifact";
const ARTIFACTS_DIR = ".grekt/artifacts";

function createHookFile(overrides: Partial<{
  path: string;
  name: string;
  description: string;
  target: string;
  hooks: Record<string, unknown[]>;
}>): ScannedFile {
  const {
    path: filePath = "hooks/format.json",
    name = "format-on-save",
    description = "Auto-format files after edit",
    target = "claude",
    hooks = {
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
      content: { target, hooks },
    },
  };
}

function createArtifactHooksDir(testDir: string, artifactId: string, files: Record<string, string>): void {
  const hooksDir = join(testDir, ARTIFACTS_DIR, artifactId, "hooks");
  mkdirSync(hooksDir, { recursive: true });

  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(hooksDir, fileName), content);
  }
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
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, { "format.sh": "#!/bin/bash\necho ok" });
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(existsSync(join(testDir, ".claude/settings.json"))).toBe(true);
    });

    test("writes hooks to correct key in settings", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.PostToolUse).toHaveLength(1);
    });

    test("does not rewrite command paths", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      const command = settings.hooks.PostToolUse[0].hooks[0].command;
      expect(command).toBe("./format.sh");
    });

    test("copies script files to target hooks directory", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {
        "format.sh": "#!/bin/bash\necho format",
        "lint.sh": "#!/bin/bash\necho lint",
      });
      const hookFiles = [createHookFile({})];

      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.copiedFiles).toBe(2);
      expect(existsSync(join(testDir, ".claude/hooks/format.sh"))).toBe(true);
      expect(existsSync(join(testDir, ".claude/hooks/lint.sh"))).toBe(true);
    });

    test("skips JSON files when copying", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {
        "hooks.json": '{"grk-type": "hooks"}',
        "format.sh": "#!/bin/bash\necho ok",
      });
      const hookFiles = [createHookFile({})];

      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.copiedFiles).toBe(1);
      expect(existsSync(join(testDir, ".claude/hooks/hooks.json"))).toBe(false);
      expect(existsSync(join(testDir, ".claude/hooks/format.sh"))).toBe(true);
    });

    test("detects file collisions and skips existing files", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, { "format.sh": "#!/bin/bash\necho new" });
      mkdirSync(join(testDir, ".claude/hooks"), { recursive: true });
      writeFileSync(join(testDir, ".claude/hooks/format.sh"), "#!/bin/bash\necho existing");

      const hookFiles = [createHookFile({})];
      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.copiedFiles).toBe(0);
      expect(result.collisions).toEqual(["format.sh"]);
      const content = readFileSync(join(testDir, ".claude/hooks/format.sh"), "utf-8");
      expect(content).toBe("#!/bin/bash\necho existing");
    });

    test("does not duplicate definitions on re-install", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      const hookFiles = [createHookFile({})];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);
      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks.PostToolUse).toHaveLength(1);
    });

    test("preserves existing settings when adding hooks", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
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
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
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
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      const hookFiles = [createHookFile({})];

      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.installed).toBe(1);
      expect(result.targets).toContain("Claude");
    });

    test("skips hooks with unknown target", () => {
      const hookFiles = [createHookFile({ target: "unknown-tool" })];

      const result = installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(result.installed).toBe(0);
    });

    test("skips hook files with no hook definitions", () => {
      const hookFile: ScannedFile = {
        path: "hooks/empty.json",
        parsed: {
          frontmatter: { "grk-type": "hooks", "grk-name": "empty", "grk-description": "Empty hook" },
          content: { target: "claude" },
        },
      };

      const result = installHooks(testDir, TEST_ARTIFACT_ID, [hookFile]);

      expect(result.installed).toBe(0);
    });

    test("preserves non-command hook types", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      const hookFiles = [createHookFile({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "prompt", prompt: "Check if this is safe", model: "haiku" }],
            },
          ],
        },
      })];

      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      const hook = settings.hooks.PreToolUse[0].hooks[0];
      expect(hook.type).toBe("prompt");
      expect(hook.prompt).toBe("Check if this is safe");
      expect(hook.model).toBe("haiku");
    });
  });

  describe("uninstallHooks", () => {
    test("removes copied script files", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, { "format.sh": "#!/bin/bash\necho ok" });
      const hookFiles = [createHookFile({})];
      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(existsSync(join(testDir, ".claude/hooks/format.sh"))).toBe(true);

      uninstallHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      expect(existsSync(join(testDir, ".claude/hooks/format.sh"))).toBe(false);
    });

    test("removes hook definitions from settings", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      const hookFiles = [createHookFile({})];
      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      uninstallHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks).toBeUndefined();
    });

    test("preserves hooks from other sources", () => {
      createArtifactHooksDir(testDir, TEST_ARTIFACT_ID, {});
      mkdirSync(join(testDir, ".claude"), { recursive: true });
      writeFileSync(
        join(testDir, ".claude/settings.json"),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              { matcher: "Bash", hooks: [{ type: "command", command: "echo manual" }] },
            ],
          },
        }, null, 2),
      );

      const hookFiles = [createHookFile({})];
      installHooks(testDir, TEST_ARTIFACT_ID, hookFiles);
      uninstallHooks(testDir, TEST_ARTIFACT_ID, hookFiles);

      const settings = JSON.parse(readFileSync(join(testDir, ".claude/settings.json"), "utf-8"));
      expect(settings.hooks.PostToolUse).toHaveLength(1);
      expect(settings.hooks.PostToolUse[0].matcher).toBe("Bash");
    });

    test("returns 0 when hook files have no valid targets", () => {
      const hookFiles = [createHookFile({ target: "unknown-tool" })];
      const removed = uninstallHooks(testDir, TEST_ARTIFACT_ID, hookFiles);
      expect(removed).toBe(0);
    });

    test("returns 0 when no hook files provided", () => {
      const removed = uninstallHooks(testDir, TEST_ARTIFACT_ID, []);
      expect(removed).toBe(0);
    });
  });

  describe("getHookSummary", () => {
    test("groups descriptions by target", () => {
      const hookFiles = [
        createHookFile({ name: "hook-1", description: "Format files", hooks: { PostToolUse: [] } }),
        createHookFile({ name: "hook-2", description: "Lint code", hooks: { PreToolUse: [] } }),
      ];

      const summary = getHookSummary(hookFiles);

      expect(summary.get("Claude")).toHaveLength(2);
      expect(summary.get("Claude")![0]).toContain("Format files");
      expect(summary.get("Claude")![1]).toContain("Lint code");
    });

    test("handles hook files with no hook definitions", () => {
      const hookFile: ScannedFile = {
        path: "hooks/empty.json",
        parsed: {
          frontmatter: { "grk-type": "hooks", "grk-name": "empty", "grk-description": "Empty hook" },
          content: { target: "claude" },
        },
      };

      const summary = getHookSummary([hookFile]);

      expect(summary.get("Claude")).toHaveLength(1);
      expect(summary.get("Claude")![0]).toBe("Empty hook");
    });
  });
});
