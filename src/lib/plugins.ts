import type { SyncPlugin } from "#/plugins/types.js";
import type { SyncTarget } from "#/schemas/index.js";
import { claudePlugin } from "#/plugins/claude.js";
import { cursorPlugin } from "#/plugins/cursor.js";

// Built-in plugins
const builtInPlugins: Record<string, SyncPlugin> = {
  claude: claudePlugin,
  cursor: cursorPlugin,
};

// Registry for all loaded plugins
const plugins: Map<string, SyncPlugin> = new Map(Object.entries(builtInPlugins));

/**
 * Get a plugin by target name
 */
export function getAdapter(target: SyncTarget): SyncPlugin {
  const plugin = plugins.get(target);
  if (!plugin) {
    throw new Error(`Unknown sync target: ${target}. Available: ${getAvailableTargets().join(", ")}`);
  }
  return plugin;
}

/**
 * Get multiple plugins
 */
export function getAdapters(targets: SyncTarget[]): SyncPlugin[] {
  return targets.map(getAdapter);
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
 * Check if a target is available
 */
export function hasPlugin(target: string): boolean {
  return plugins.has(target);
}

// Re-export types
export type { SyncPlugin, SyncResult, SyncOptions, SyncPreview } from "#/plugins/types.js";
