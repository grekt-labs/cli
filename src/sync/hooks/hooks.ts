/**
 * Hook install/uninstall utilities.
 *
 * Hooks are installed during `grekt add` and removed during `grekt remove`.
 * They modify target tool settings files (e.g. .claude/settings.json)
 * independently from the sync system.
 */

import { dirname } from "path";
import { fs } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getHookTarget, getHookTargetIds } from "./hooks.config";
import type { ScannedFile } from "@grekt-labs/cli-engine";
import type { ParsedHookContent, HookEventDefinition, HookEventsMap } from "./hooks.types";

/**
 * Marker added to hook commands to identify grekt-managed hooks.
 * Used during uninstall to filter out hooks belonging to a specific artifact.
 */
function getArtifactHookPath(artifactId: string): string {
  return `${ARTIFACTS_DIR}/${artifactId}/`;
}

/**
 * Resolve event definitions from parsed hook content.
 * Returns an empty object if no hooks are defined.
 */
function resolveEventDefinitions(content: ParsedHookContent): HookEventsMap {
  return content.hooks ?? {};
}

/**
 * Rewrite relative command paths to point to the artifact's hooks directory.
 * e.g. "./format.sh" -> ".grekt/artifacts/@scope/name/hooks/format.sh"
 */
function rewriteCommandPath(command: string, context: { artifactId: string; hookFilePath: string }): string {
  if (!command.startsWith("./") && !command.startsWith("../")) {
    return command;
  }

  const hookDir = dirname(context.hookFilePath);
  const artifactBasePath = `${ARTIFACTS_DIR}/${context.artifactId}`;

  if (hookDir && hookDir !== ".") {
    return `${artifactBasePath}/${hookDir}/${command.replace(/^\.\//, "")}`;
  }

  return `${artifactBasePath}/${command.replace(/^\.\//, "")}`;
}

/**
 * Read a JSON settings file, returning empty object if it doesn't exist or is invalid.
 */
function readSettingsFile(projectRoot: string, settingsFile: string): Record<string, unknown> {
  const fullPath = `${projectRoot}/${settingsFile}`;

  if (!fs.exists(fullPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFile(fullPath));
  } catch {
    return {};
  }
}

/**
 * Write a JSON settings file, creating parent directories if needed.
 */
function writeSettingsFile(projectRoot: string, settingsFile: string, data: Record<string, unknown>): void {
  const fullPath = `${projectRoot}/${settingsFile}`;
  const dir = dirname(fullPath);

  if (!fs.exists(dir)) {
    fs.mkdir(dir, { recursive: true });
  }

  fs.writeFile(fullPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Rewrite all command paths in hook event definitions.
 * Only rewrites entries that have a `command` field (command type hooks).
 * Prompt and agent type hooks are passed through unchanged.
 */
function rewriteEventDefinitions(
  events: HookEventsMap,
  artifactId: string,
  hookFilePath: string,
): Record<string, HookEventDefinition[]> {
  const rewritten: Record<string, HookEventDefinition[]> = {};

  for (const [eventName, definitions] of Object.entries(events)) {
    if (!definitions) continue;

    rewritten[eventName] = definitions.map((def) => ({
      ...def,
      hooks: def.hooks.map((hook) => {
        if (hook.type === "command") {
          return {
            ...hook,
            command: rewriteCommandPath(hook.command, { artifactId, hookFilePath }),
          };
        }
        return hook;
      }),
    }));
  }

  return rewritten;
}

/**
 * Merge hook event definitions into existing hooks in settings.
 */
function mergeHooks(
  existingHooks: Record<string, HookEventDefinition[]>,
  newHooks: Record<string, HookEventDefinition[]>,
): Record<string, HookEventDefinition[]> {
  const merged = { ...existingHooks };

  for (const [eventName, definitions] of Object.entries(newHooks)) {
    if (!merged[eventName]) {
      merged[eventName] = [];
    }
    merged[eventName] = [...merged[eventName], ...definitions];
  }

  return merged;
}

export interface InstallHooksResult {
  installed: number;
  targets: string[];
}

/**
 * Install hooks from an artifact into target tool settings.
 *
 * Reads hook JSON files from the scanned artifact, rewrites command paths
 * to point to the artifact's location, and merges them into the target's
 * settings file.
 */
export function installHooks(
  projectRoot: string,
  artifactId: string,
  hookFiles: ScannedFile[],
): InstallHooksResult {
  const result: InstallHooksResult = { installed: 0, targets: [] };
  const targetIds = getHookTargetIds();

  // Group hooks by target
  const hooksByTarget = new Map<string, Array<{ content: ParsedHookContent; path: string }>>();

  for (const hookFile of hookFiles) {
    const content = hookFile.parsed.content as ParsedHookContent;

    if (!content.target || !targetIds.includes(content.target)) {
      continue;
    }

    const events = resolveEventDefinitions(content);
    if (Object.keys(events).length === 0) {
      continue;
    }

    if (!hooksByTarget.has(content.target)) {
      hooksByTarget.set(content.target, []);
    }
    hooksByTarget.get(content.target)!.push({ content, path: hookFile.path });
  }

  // Install hooks for each target
  for (const [targetId, hooks] of hooksByTarget) {
    const targetConfig = getHookTarget(targetId);
    if (!targetConfig) continue;

    const settings = readSettingsFile(projectRoot, targetConfig.settingsFile);
    let existingHooks = (settings[targetConfig.hooksKey] ?? {}) as Record<string, HookEventDefinition[]>;

    for (const { content, path } of hooks) {
      const events = resolveEventDefinitions(content);
      const rewrittenEvents = rewriteEventDefinitions(events, artifactId, path);
      existingHooks = mergeHooks(existingHooks, rewrittenEvents);
      result.installed++;
    }

    settings[targetConfig.hooksKey] = existingHooks;
    writeSettingsFile(projectRoot, targetConfig.settingsFile, settings);
    result.targets.push(targetConfig.displayName);
  }

  return result;
}

/**
 * Uninstall hooks belonging to an artifact from all target tool settings.
 *
 * Identifies hooks by checking if their command path contains the
 * artifact's path prefix (.grekt/artifacts/{id}/).
 */
export function uninstallHooks(projectRoot: string, artifactId: string): number {
  const artifactPath = getArtifactHookPath(artifactId);
  let removedCount = 0;

  for (const targetId of getHookTargetIds()) {
    const targetConfig = getHookTarget(targetId)!;
    const settings = readSettingsFile(projectRoot, targetConfig.settingsFile);
    const hooks = settings[targetConfig.hooksKey] as Record<string, HookEventDefinition[]> | undefined;

    if (!hooks) continue;

    const cleanedHooks: Record<string, HookEventDefinition[]> = {};
    let targetModified = false;

    for (const [eventName, definitions] of Object.entries(hooks)) {
      const filtered = definitions.filter((def) => {
        const belongsToArtifact = def.hooks.some((hook) =>
          hook.type === "command" && hook.command.includes(artifactPath)
        );

        if (belongsToArtifact) {
          removedCount++;
          targetModified = true;
          return false;
        }
        return true;
      });

      if (filtered.length > 0) {
        cleanedHooks[eventName] = filtered;
      }
    }

    if (targetModified) {
      if (Object.keys(cleanedHooks).length > 0) {
        settings[targetConfig.hooksKey] = cleanedHooks;
      } else {
        delete settings[targetConfig.hooksKey];
      }
      writeSettingsFile(projectRoot, targetConfig.settingsFile, settings);
    }
  }

  return removedCount;
}

/**
 * Get a summary of hooks for display purposes.
 * Returns a list of descriptions grouped by target.
 */
export function getHookSummary(hookFiles: ScannedFile[]): Map<string, string[]> {
  const summary = new Map<string, string[]>();

  for (const hookFile of hookFiles) {
    const content = hookFile.parsed.content as ParsedHookContent;
    const target = content.target;
    const targetConfig = getHookTarget(target);
    const displayName = targetConfig?.displayName ?? target;

    if (!summary.has(displayName)) {
      summary.set(displayName, []);
    }

    const description = hookFile.parsed.frontmatter["grk-description"];
    const events = resolveEventDefinitions(content);
    const eventNames = Object.keys(events).join(", ");
    const label = eventNames ? `${description} (${eventNames})` : String(description);
    summary.get(displayName)!.push(label);
  }

  return summary;
}
