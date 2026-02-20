import { describe, test, expect } from "bun:test";
import {
  getPlugin,
  getPlugins,
  registerPlugin,
  getAvailableTargets,
  getPluginChoices,
  getDefaultTarget,
  hasPlugin,
  validateTargets,
} from "./manager";
import type { SyncPlugin } from "#/sync/sync.types";

const BUILTIN_PLUGINS = ["claude", "cursor", "opencode", "windsurf", "cline", "copilot", "aider", "continue", "amazonq", "openclaw", "global"] as const;

describe("manager", () => {
  describe("getPlugin", () => {
    test("returns built-in plugins by id", () => {
      for (const id of BUILTIN_PLUGINS) {
        const plugin = getPlugin(id);
        expect(plugin.id).toBe(id);
      }
    });

    test("throws for unknown plugin with helpful message", () => {
      expect(() => getPlugin("nonexistent")).toThrow(/Unknown sync target.*nonexistent/);
    });

    test("creates plugin from customTargets config", () => {
      const customTargets = {
        myCustom: { name: "My Custom", contextEntryPoint: ".myrules" },
      };

      const plugin = getPlugin("myCustom", customTargets);

      expect(plugin.id).toBe("myCustom");
      expect(plugin.name).toBe("My Custom");
      // Without paths, targetFile is the target-id (used as base for default paths)
      expect(plugin.targetFile).toBe("myCustom");
    });

    test("prefers built-in over custom with same id", () => {
      const customTargets = {
        claude: { name: "Fake Claude", contextEntryPoint: ".fake" },
      };

      const plugin = getPlugin("claude", customTargets);

      expect(plugin.name).toBe("Claude");
    });
  });

  describe("getPlugins", () => {
    test("returns plugins in requested order", () => {
      const plugins = getPlugins(["cursor", "claude"]);

      expect(plugins[0].id).toBe("cursor");
      expect(plugins[1].id).toBe("claude");
    });

    test("throws on first unknown plugin", () => {
      expect(() => getPlugins(["claude", "invalid"])).toThrow(/Unknown sync target.*invalid/);
    });

    test("handles empty array", () => {
      expect(getPlugins([])).toHaveLength(0);
    });
  });

  describe("registerPlugin", () => {
    test("makes plugin retrievable", () => {
      const plugin: SyncPlugin = {
        id: "test-registered",
        name: "Test",
        targetFile: ".test",
        targetExists: () => false,
        sync: async () => ({ created: [], updated: [], skipped: [] }),
        preview: () => ({ willCreate: [], willUpdate: [], willSkip: [] }),
      };

      registerPlugin(plugin);

      expect(hasPlugin("test-registered")).toBe(true);
      expect(getPlugin("test-registered")).toBe(plugin);
    });
  });

  describe("getAvailableTargets", () => {
    test("includes all built-in plugins", () => {
      const targets = getAvailableTargets();

      for (const id of BUILTIN_PLUGINS) {
        expect(targets).toContain(id);
      }
    });
  });

  describe("getPluginChoices", () => {
    test("returns choices matching all built-in plugins", () => {
      const choices = getPluginChoices();
      const choiceValues = choices.map(c => c.value);

      for (const id of BUILTIN_PLUGINS) {
        expect(choiceValues).toContain(id);
      }
    });

    test("each choice has a human-readable name and plugin id", () => {
      const choices = getPluginChoices();

      for (const choice of choices) {
        expect(choice.name.length).toBeGreaterThan(0);
        expect(choice.value.length).toBeGreaterThan(0);
        expect(choice.name).not.toBe(choice.value);
      }
    });
  });

  describe("getDefaultTarget", () => {
    test("returns global as the first registered plugin", () => {
      const target = getDefaultTarget();
      expect(target).toBe("global");
    });
  });

  describe("hasPlugin", () => {
    test("returns true for built-in, false for unknown", () => {
      expect(hasPlugin("claude")).toBe(true);
      expect(hasPlugin("nonexistent")).toBe(false);
    });
  });

  describe("validateTargets", () => {
    test("returns valid targets unchanged", () => {
      const input = ["claude", "cursor"];
      expect(validateTargets(input)).toEqual(input);
    });

    test("throws listing all invalid targets", () => {
      expect(() => validateTargets(["bad1", "bad2"])).toThrow(/Invalid targets: bad1, bad2/);
    });

    test("accepts empty array", () => {
      expect(validateTargets([])).toEqual([]);
    });
  });
});
