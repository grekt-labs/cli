import { dirname, join } from "path";
import type { SyncPlugin } from "#/sync/sync.types";
import {
  type CustomTarget,
  CATEGORIES,
  CATEGORY_CONFIG,
  type Category,
} from "@grekt-labs/cli-engine";
import { claudePlugin } from "#/sync/plugins/claude/claude";
import { cursorPlugin } from "#/sync/plugins/cursor/cursor";
import { opencodePlugin } from "#/sync/plugins/opencode/opencode";
import { windsurfPlugin } from "#/sync/plugins/windsurf/windsurf";
import { clinePlugin } from "#/sync/plugins/cline/cline";
import { copilotPlugin } from "#/sync/plugins/copilot/copilot";
import { aiderPlugin } from "#/sync/plugins/aider/aider";
import { continuePlugin } from "#/sync/plugins/continue/continue";
import { amazonqPlugin } from "#/sync/plugins/amazonq/amazonq";
import { globalPlugin } from "#/sync/plugins/universal/universal";
import { createFolderPlugin, GREKT_ENTRY_POINT_TEXT } from "#/sync/base/base";

export type SyncPaths = Record<Category, string>;

const builtInPlugins: Record<string, SyncPlugin> = {
  global: globalPlugin,
  claude: claudePlugin,
  cursor: cursorPlugin,
  opencode: opencodePlugin,
  windsurf: windsurfPlugin,
  cline: clinePlugin,
  copilot: copilotPlugin,
  aider: aiderPlugin,
  continue: continuePlugin,
  amazonq: amazonqPlugin,
};

/** The global plugin ID uses the agentskills.io standard (.agents/) */
export const GLOBAL_PLUGIN_ID = "global";

// Registry for all loaded plugins
const plugins: Map<string, SyncPlugin> = new Map(Object.entries(builtInPlugins));

/**
 * Generate content block for custom targets.
 * Includes explanation of grk-types and where CORE artifacts are located.
 */
function generateCustomBlockContent(targetDir: string): () => string {
  return () => {
    const lines = [
      GREKT_ENTRY_POINT_TEXT,
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
    entryPoints: [config.contextEntryPoint],
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
 * Get sync paths for a target (where files are copied to).
 * Returns null if target doesn't copy files (RulesOnlyPlugin).
 */
export function getSyncPaths(target: string, customTargets?: Record<string, CustomTarget>): SyncPaths | null {
  const plugin = getPlugin(target, customTargets);
  return plugin.getSyncPaths();
}

// Re-export types
export type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "#/sync/sync.types";
