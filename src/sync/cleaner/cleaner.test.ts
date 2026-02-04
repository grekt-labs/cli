import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { getTargetPaths, cleanTargetPaths } from "./cleaner";

describe("cleaner", () => {
  const testDir = join(process.cwd(), ".test-cleaner");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("getTargetPaths", () => {
    test("returns paths for built-in claude target", () => {
      const paths = getTargetPaths("claude");

      expect(paths).toEqual({
        targetDir: ".claude",
        contextEntryPoint: ".claude/CLAUDE.md",
      });
    });

    test("returns paths for built-in cursor target", () => {
      const paths = getTargetPaths("cursor");

      expect(paths).toEqual({
        targetDir: "",
        contextEntryPoint: ".cursorrules",
      });
    });

    test("returns paths for built-in opencode target", () => {
      const paths = getTargetPaths("opencode");

      expect(paths).toEqual({
        targetDir: ".opencode",
        contextEntryPoint: "",
      });
    });

    test("returns paths for custom target with explicit paths", () => {
      const customTargets = {
        "my-ai": {
          name: "My AI",
          contextEntryPoint: ".my-ai/config.md",
          paths: {
            agents: ".my-ai/agents",
            skills: ".my-ai/skills",
            commands: ".my-ai/commands",
          },
        },
      };

      const paths = getTargetPaths("my-ai", customTargets);

      expect(paths).toEqual({
        targetDir: ".my-ai",
        contextEntryPoint: ".my-ai/config.md",
      });
    });

    test("returns paths for custom target without explicit paths", () => {
      const customTargets = {
        "custom-tool": {
          name: "Custom Tool",
          contextEntryPoint: "custom-tool/README.md",
        },
      };

      const paths = getTargetPaths("custom-tool", customTargets);

      expect(paths).toEqual({
        targetDir: "custom-tool",
        contextEntryPoint: "custom-tool/README.md",
      });
    });

    test("returns null for unknown target", () => {
      const paths = getTargetPaths("unknown");

      expect(paths).toBeNull();
    });
  });

  describe("cleanTargetPaths", () => {
    test("deletes target directory for claude", () => {
      const claudeDir = join(testDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(join(claudeDir, "CLAUDE.md"), "content");

      const result = cleanTargetPaths(testDir, "claude");

      expect(existsSync(claudeDir)).toBe(false);
      expect(result.deleted).toContain(".claude");
    });

    test("deletes only context file for cursor (no targetDir)", () => {
      const cursorFile = join(testDir, ".cursorrules");
      writeFileSync(cursorFile, "content");

      const result = cleanTargetPaths(testDir, "cursor");

      expect(existsSync(cursorFile)).toBe(false);
      expect(result.deleted).toContain(".cursorrules");
    });

    test("reports notFound when directory does not exist", () => {
      const result = cleanTargetPaths(testDir, "claude");

      expect(result.deleted).toHaveLength(0);
      expect(result.notFound).toContain(".claude");
    });

    test("deletes custom target directory", () => {
      const customDir = join(testDir, "my-custom");
      mkdirSync(customDir, { recursive: true });
      writeFileSync(join(customDir, "config.md"), "content");

      const customTargets = {
        "my-custom": {
          name: "My Custom",
          contextEntryPoint: "my-custom/config.md",
        },
      };

      const result = cleanTargetPaths(testDir, "my-custom", customTargets);

      expect(existsSync(customDir)).toBe(false);
      expect(result.deleted).toContain("my-custom");
    });

    test("does not delete contextEntryPoint inside targetDir twice", () => {
      const claudeDir = join(testDir, ".claude");
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(join(claudeDir, "CLAUDE.md"), "content");

      const result = cleanTargetPaths(testDir, "claude");

      // Should only have .claude in deleted, not .claude/CLAUDE.md separately
      expect(result.deleted).toEqual([".claude"]);
    });

    test("returns empty result for unknown target", () => {
      const result = cleanTargetPaths(testDir, "unknown");

      expect(result.deleted).toHaveLength(0);
      expect(result.notFound).toHaveLength(0);
    });

    test("handles contextEntryPoint outside targetDir", () => {
      // Custom target without explicit paths - uses targetId as base
      // contextEntryPoint is at root level, outside the target folder
      const customDir = join(testDir, "special");
      const configFile = join(testDir, "config.md");
      mkdirSync(customDir, { recursive: true });
      writeFileSync(configFile, "content");

      const customTargets = {
        "special": {
          name: "Special",
          contextEntryPoint: "config.md",
        },
      };

      const result = cleanTargetPaths(testDir, "special", customTargets);

      // targetDir is "special" (the targetId since no explicit paths)
      // contextEntryPoint "config.md" is outside "special/"
      expect(existsSync(customDir)).toBe(false);
      expect(existsSync(configFile)).toBe(false);
      expect(result.deleted).toContain("special");
      expect(result.deleted).toContain("config.md");
    });
  });

  describe("security: dangerous path protection", () => {
    test("does NOT delete project root when targetDir resolves to '.'", () => {
      const testFile = join(testDir, "important.txt");
      writeFileSync(testFile, "do not delete me");

      const customTargets = {
        dangerous: {
          name: "Dangerous",
          contextEntryPoint: "INSTRUCTIONS.md",
          paths: {
            agents: "agents",
          },
        },
      };

      const result = cleanTargetPaths(testDir, "dangerous", customTargets);

      expect(existsSync(testDir)).toBe(true);
      expect(existsSync(testFile)).toBe(true);
      expect(result.deleted).not.toContain(".");
      expect(result.deleted).toHaveLength(0);
    });

    test("does NOT delete parent directory with '..' path", () => {
      const customTargets = {
        "evil-target": {
          name: "Evil",
          contextEntryPoint: "../outside.md",
          paths: {
            agents: "agents",
          },
        },
      };

      const result = cleanTargetPaths(testDir, "evil-target", customTargets);

      expect(existsSync(testDir)).toBe(true);
      expect(result.deleted).not.toContain("..");
    });

    test("does NOT delete paths outside project root (path traversal)", () => {
      const customTargets = {
        "traversal-target": {
          name: "Traversal",
          contextEntryPoint: "../../etc/passwd",
          paths: {
            agents: "agents",
          },
        },
      };

      const result = cleanTargetPaths(testDir, "traversal-target", customTargets);

      expect(result.deleted).toHaveLength(0);
    });

    test("does NOT delete when custom target contextEntryPoint is root-level file", () => {
      // This was the original bug: dirname("INSTRUCTIONS.md") returns "."
      const testFile = join(testDir, "important.txt");
      writeFileSync(testFile, "do not delete me");

      const customTargets = {
        codex: {
          name: "Codex",
          contextEntryPoint: "INSTRUCTIONS.md",
          paths: {
            agents: ".codex/agents",
          },
        },
      };

      const result = cleanTargetPaths(testDir, "codex", customTargets);

      // dirname("INSTRUCTIONS.md") = "." which should be normalized to ""
      // and then rejected as dangerous
      expect(existsSync(testDir)).toBe(true);
      expect(existsSync(testFile)).toBe(true);
    });

    test("safely deletes valid nested directory", () => {
      const nestedDir = join(testDir, ".safe-target");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, "config.md"), "content");

      const customTargets = {
        "safe-target": {
          name: "Safe Target",
          contextEntryPoint: ".safe-target/config.md",
          paths: {
            agents: ".safe-target/agents",
          },
        },
      };

      const result = cleanTargetPaths(testDir, "safe-target", customTargets);

      expect(existsSync(nestedDir)).toBe(false);
      expect(result.deleted).toContain(".safe-target");
    });
  });

  describe("getTargetPaths: dirname normalization", () => {
    test("normalizes '.' to empty string for root-level contextEntryPoint", () => {
      const customTargets = {
        "root-file-target": {
          name: "Root File",
          contextEntryPoint: "INSTRUCTIONS.md",
          paths: {
            agents: "agents",
          },
        },
      };

      const paths = getTargetPaths("root-file-target", customTargets);

      // dirname("INSTRUCTIONS.md") returns "." but should be normalized to ""
      expect(paths?.targetDir).toBe("");
    });

    test("preserves valid directory from dirname", () => {
      const customTargets = {
        "nested-target": {
          name: "Nested",
          contextEntryPoint: ".nested/config.md",
          paths: {
            agents: ".nested/agents",
          },
        },
      };

      const paths = getTargetPaths("nested-target", customTargets);

      expect(paths?.targetDir).toBe(".nested");
    });
  });
});
