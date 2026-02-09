/**
 * Hook system types.
 *
 * Hooks are lifecycle commands installed into target tool settings
 * (e.g. Claude's .claude/settings.json) during artifact add/remove.
 * Completely decoupled from the sync system.
 */

/** Configuration for a target that supports hooks */
export interface HookTargetConfig {
  /** Path to the settings file relative to project root */
  settingsFile: string;
  /** Key in the settings file where hooks are stored */
  hooksKey: string;
  /** Display name for the target */
  displayName: string;
}

/** A single hook entry as stored in a target's settings file */
export interface HookEntry {
  type: "command";
  command: string;
}

/** A hook event definition with matcher and hook entries */
export interface HookEventDefinition {
  matcher: string;
  hooks: HookEntry[];
}

/** Parsed hook content from artifact JSON (after grk-* fields stripped) */
export interface ParsedHookContent {
  target: string;
  events: Record<string, HookEventDefinition[]>;
}
