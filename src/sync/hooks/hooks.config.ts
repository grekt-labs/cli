/**
 * Hook target configuration.
 *
 * Defines which targets support hooks and where their settings live.
 * Adding a new target is just adding an entry here.
 */

import type { HookTargetConfig } from "./hooks.types";

export const HOOK_TARGETS: Record<string, HookTargetConfig> = {
  claude: {
    settingsFile: ".claude/settings.json",
    hooksKey: "hooks",
    displayName: "Claude",
  },
};

export function getHookTarget(targetId: string): HookTargetConfig | undefined {
  return HOOK_TARGETS[targetId];
}

export function getHookTargetIds(): string[] {
  return Object.keys(HOOK_TARGETS);
}
