/**
 * Hook system types.
 *
 * Hooks are lifecycle commands installed into target tool settings
 * (e.g. Claude's .claude/settings.json) during artifact add/remove.
 * Completely decoupled from the sync system.
 *
 * Types align with the Claude Code hooks specification:
 * - 3 handler types: command, prompt, agent
 * - 14 event types with optional matchers
 * - Optional fields: timeout, async, statusMessage, model, once
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

/** A shell command hook entry */
export interface CommandHookEntry {
  type: "command";
  command: string;
  /** Run in background without blocking */
  async?: boolean;
  /** Timeout in seconds (default: 600) */
  timeout?: number;
  /** Custom spinner message while hook runs */
  statusMessage?: string;
  /** Run only once per session then removed (skills only) */
  once?: boolean;
}

/** A prompt hook entry (processed by a model) */
export interface PromptHookEntry {
  type: "prompt";
  prompt: string;
  /** Model to use (defaults to a fast model) */
  model?: string;
  /** Timeout in seconds (default: 30) */
  timeout?: number;
  /** Custom spinner message while hook runs */
  statusMessage?: string;
  /** Run only once per session then removed (skills only) */
  once?: boolean;
}

/** An agent hook entry (can use tools for up to 50 turns) */
export interface AgentHookEntry {
  type: "agent";
  prompt: string;
  /** Model to use (defaults to a fast model) */
  model?: string;
  /** Timeout in seconds (default: 60) */
  timeout?: number;
  /** Custom spinner message while hook runs */
  statusMessage?: string;
  /** Run only once per session then removed (skills only) */
  once?: boolean;
}

/** A single hook entry as stored in a target's settings file */
export type HookEntry = CommandHookEntry | PromptHookEntry | AgentHookEntry;

/** A hook event definition with optional matcher and hook entries */
export interface HookEventDefinition {
  /** Regex pattern to filter when this definition fires. Omit to match all. */
  matcher?: string;
  hooks: HookEntry[];
}

/**
 * All supported Claude Code hook event types.
 *
 * SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest,
 * PostToolUse, PostToolUseFailure, Notification, SubagentStart,
 * SubagentStop, Stop, TeammateIdle, TaskCompleted, PreCompact, SessionEnd
 */
export type HookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PermissionRequest"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop"
  | "TeammateIdle"
  | "TaskCompleted"
  | "PreCompact"
  | "SessionEnd";

/** Map of event names to their definitions */
export type HookEventsMap = Partial<Record<HookEventName, HookEventDefinition[]>>;

/** Parsed hook content from artifact JSON (after grk-* fields stripped) */
export interface ParsedHookContent {
  target: string;
  hooks: HookEventsMap;
}
