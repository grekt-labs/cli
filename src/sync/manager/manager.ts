import { dirname, join } from "path";
import type { SyncPlugin } from "#/sync/sync.types";
import {
  type CustomTarget,
  type FolderPluginConfig,
  type RulesOnlyPluginConfig,
  CATEGORIES,
  CATEGORY_CONFIG,
  type Category,
} from "@grekt-labs/cli-engine";
import { claudePlugin } from "#/sync/plugins/claude/claude";
import { cursorPlugin } from "#/sync/plugins/cursor/cursor";
import { opencodePlugin } from "#/sync/plugins/opencode/opencode";
import { createRulesOnlyPlugin, createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";

// Note: createRulesOnlyPlugin and RulesOnlyPluginConfig kept for built-in cursor plugin

export type SyncPaths = Record<Category, string>;

type PluginConfig =
  | { type: "folder"; config: FolderPluginConfig }
  | { type: "rulesOnly"; config: RulesOnlyPluginConfig };

const builtInConfigs: Record<string, PluginConfig> = {
  claude: {
    type: "folder",
    config: {
      id: "claude",
      name: "Claude",
      targetDir: ".claude",
      contextEntryPoint: ".claude/CLAUDE.md",
      generateRulesContent: generateDefaultBlockContent,
    },
  },
  cursor: {
    type: "rulesOnly",
    config: {
      id: "cursor",
      name: "Cursor",
      contextEntryPoint: ".cursorrules",
      generateRulesContent: generateDefaultBlockContent,
    },
  },
  opencode: {
    type: "folder",
    config: {
      id: "opencode",
      name: "OpenCode",
      targetDir: ".opencode",
    },
  },
};

const builtInPlugins: Record<string, SyncPlugin> = {
  claude: claudePlugin,
  cursor: cursorPlugin,
  opencode: opencodePlugin,
};

// Registry for all loaded plugins
const plugins: Map<string, SyncPlugin> = new Map(Object.entries(builtInPlugins));

/**
 * Generate content block for custom targets.
 * Includes explanation of grk-types and where CORE artifacts are located.
 */
function generateCustomBlockContent(targetDir: string): () => string {
  return () => {
    const lines = [
      "**MANDATORY:** Read `.grekt/index` at session start to discover artifacts.",
      "",
      "**CORE artifacts in:**",
      `- ${targetDir}/agents/ - autonomous specialists for complex tasks`,
      `- ${targetDir}/skills/ - reusable capabilities`,
      `- ${targetDir}/commands/ - user-invoked actions`,
    ];
    return lines.join("\n");
  };
}

/**
 * Create a plugin for a custom target.
 * Always uses FolderPlugin to support CORE artifacts.
 * If no paths defined, uses target-id as base directory for default paths.
 */
function createCustomPlugin(id: string, config: CustomTarget): SyncPlugin {
  // Use provided paths or default to target-id based paths
  const targetDir = config.paths ? dirname(config.contextEntryPoint) : id;
  const paths = config.paths ?? buildDefaultPaths(id);

  return createFolderPlugin({
    id,
    name: config.name,
    targetDir,
    contextEntryPoint: config.contextEntryPoint,
    paths,
    generateRulesContent: generateCustomBlockContent(targetDir),
  });
}

/**
 * Build default paths for a custom target using target-id as base.
 */
function buildDefaultPaths(targetId: string): Record<Category, string> {
  const paths = {} as Record<Category, string>;
  for (const category of CATEGORIES) {
    paths[category] = join(targetId, CATEGORY_CONFIG[category].defaultPath);
  }
  return paths;
}

/**
 * Get a plugin by target name
 * For custom targets, pass the customTargets config to create the plugin dynamically
 */
export function getPlugin(target: string, customTargets?: Record<string, CustomTarget>): SyncPlugin {
  // Check built-in plugins first
  const plugin = plugins.get(target);
  if (plugin) {
    return plugin;
  }

  // Check custom targets
  if (customTargets && customTargets[target]) {
    return createCustomPlugin(target, customTargets[target]);
  }

  throw new Error(`Unknown sync target: ${target}. Available: ${getAvailableTargets().join(", ")}`);
}

/**
 * Get multiple plugins
 */
export function getPlugins(targets: string[], customTargets?: Record<string, CustomTarget>): SyncPlugin[] {
  return targets.map((target) => getPlugin(target, customTargets));
}

/**
 * Register a new plugin
 */
export function registerPlugin(plugin: SyncPlugin): void {
  plugins.set(plugin.id, plugin);
}

/**
 * Get all available target names
 */
export function getAvailableTargets(): string[] {
  return Array.from(plugins.keys());
}

/**
 * Get plugin choices for prompts (name/value pairs)
 */
export function getPluginChoices(): Array<{ name: string; value: string }> {
  return Array.from(plugins.values()).map((plugin) => ({
    name: plugin.name,
    value: plugin.id,
  }));
}

/**
 * Get the default target (first registered plugin)
 */
export function getDefaultTarget(): string {
  const first = plugins.keys().next().value;
  if (!first) {
    throw new Error("No plugins registered");
  }
  return first;
}

/**
 * Check if a target is available
 */
export function hasPlugin(target: string): boolean {
  return plugins.has(target);
}

/**
 * Validate targets against registered plugins
 */
export function validateTargets(targets: string[]): string[] {
  const available = getAvailableTargets();
  const invalid = targets.filter((t) => !available.includes(t));
  if (invalid.length > 0) {
    throw new Error(`Invalid targets: ${invalid.join(", ")}. Available: ${available.join(", ")}`);
  }
  return targets;
}

/**
 * Build sync paths from config, using category defaults.
 */
function buildSyncPaths(baseDir: string, configPaths?: Partial<Record<Category, string>>): SyncPaths {
  const paths = {} as SyncPaths;
  for (const category of CATEGORIES) {
    paths[category] = configPaths?.[category] ?? join(baseDir, CATEGORY_CONFIG[category].defaultPath);
  }
  return paths;
}

/**
 * Get sync paths for a target (where files are copied to).
 * Returns null if target doesn't copy files (RulesOnlyPlugin).
 */
export function getSyncPaths(target: string, customTargets?: Record<string, CustomTarget>): SyncPaths | null {
  // Check built-in plugins
  const builtIn = builtInConfigs[target];
  if (builtIn) {
    if (builtIn.type === "rulesOnly") return null;
    return buildSyncPaths(builtIn.config.targetDir, builtIn.config.paths);
  }

  // Check custom targets - always have paths (default to target-id based)
  const customTarget = customTargets?.[target];
  if (!customTarget) return null;

  if (customTarget.paths) {
    const baseDir = dirname(customTarget.contextEntryPoint);
    return buildSyncPaths(baseDir, customTarget.paths);
  }

  // Default paths using target-id as base
  return buildSyncPaths(target, buildDefaultPaths(target));
}

// Re-export types
export type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "#/sync/sync.types";
