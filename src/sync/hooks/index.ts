export { installHooks, uninstallHooks, getHookSummary } from "./hooks";
export { promptAndInstallHooks } from "./hooks.prompt";
export type { InstallHooksResult } from "./hooks";
export { getHookTarget, getHookTargetIds, HOOK_TARGETS } from "./hooks.config";
export type {
  HookTargetConfig,
  ParsedHookContent,
  HookEventDefinition,
  HookEntry,
  HookEventsMap,
  HookEventName,
  CommandHookEntry,
  PromptHookEntry,
  AgentHookEntry,
} from "./hooks.types";
