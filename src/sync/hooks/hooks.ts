/**
 * Hook install/uninstall utilities.
 *
 * Hooks are installed during `grekt add` and removed during `grekt remove`.
 * They modify target tool settings files (e.g. .claude/settings.json)
 * and copy hook script files to the target's hooks directory.
 * Completely independent from the sync system.
 *
 * No manifest or external tracking needed — the artifact on disk
 * is the source of truth for both install and uninstall.
 */

import { dirname, join } from "path";
import { fs } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getHookTarget, getHookTargetIds } from "./hooks.config";
import type { ScannedFile } from "@grekt-labs/cli-engine";
import type { ParsedHookContent, HookEventDefinition, HookEventsMap } from "./hooks.types";

/**
 * Resolve event definitions from parsed hook content.
 * Returns an empty object if no hooks are defined.
 */
function resolveEventDefinitions(content: ParsedHookContent): HookEventsMap {
  return content.hooks ?? {};
}

/**
 * Read a JSON settings file, returning empty object if it doesn't exist or is invalid.
 */
function readSettingsFile(projectRoot: string, settingsFile: string): Record<string, unknown> {
  const fullPath = join(projectRoot, settingsFile);

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
  const fullPath = join(projectRoot, settingsFile);
  const dir = dirname(fullPath);

  if (!fs.exists(dir)) {
    fs.mkdir(dir, { recursive: true });
  }

  fs.writeFile(fullPath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * List non-JSON script files in an artifact's hooks directory.
 * These are the files that get copied to the target's hooks directory.
 */
function listScriptFiles(projectRoot: string, artifactId: string, hookFilePath: string): string[] {
  const hookDir = dirname(hookFilePath);
  const artifactHooksPath = join(projectRoot, ARTIFACTS_DIR, artifactId, hookDir);

  if (!fs.exists(artifactHooksPath)) {
    return [];
  }

  return fs.readdir(artifactHooksPath).filter((file) => {
    if (file.endsWith(".json")) return false;
    const srcPath = join(artifactHooksPath, file);
    return fs.stat(srcPath).isFile;
  });
}

/**
 * Copy hook script files from the artifact's hooks directory to the target's hooks directory.
 * Files are copied flat (as-is), no path transformations.
 *
 * Returns the list of copied file names and any collisions detected.
 */
function copyHookFiles(
  projectRoot: string,
  artifactId: string,
  hookFilePath: string,
  hooksDir: string,
): { copied: string[]; collisions: string[] } {
  const hookDir = dirname(hookFilePath);
  const artifactHooksPath = join(projectRoot, ARTIFACTS_DIR, artifactId, hookDir);
  const targetHooksPath = join(projectRoot, hooksDir);

  if (!fs.exists(artifactHooksPath)) {
    return { copied: [], collisions: [] };
  }

  if (!fs.exists(targetHooksPath)) {
    fs.mkdir(targetHooksPath, { recursive: true });
  }

  const files = listScriptFiles(projectRoot, artifactId, hookFilePath);
  const copied: string[] = [];
  const collisions: string[] = [];

  for (const file of files) {
    const srcPath = join(artifactHooksPath, file);
    const destPath = join(targetHooksPath, file);

    if (fs.exists(destPath)) {
      collisions.push(file);
      continue;
    }

    fs.copyFile(srcPath, destPath);
    copied.push(file);
  }

  return { copied, collisions };
}

/**
 * Remove hook script files that were copied for an artifact.
 */
function removeHookFiles(projectRoot: string, hooksDir: string, files: string[]): void {
  for (const file of files) {
    const filePath = join(projectRoot, hooksDir, file);

    if (fs.exists(filePath)) {
      fs.unlink(filePath);
    }
  }
}

/**
 * Remove specific definitions from existing hooks in settings.
 * Uses JSON comparison to identify which definitions to remove.
 */
function removeDefinitions(
  existingHooks: Record<string, HookEventDefinition[]>,
  toRemove: Record<string, HookEventDefinition[]>,
): Record<string, HookEventDefinition[]> {
  const cleaned: Record<string, HookEventDefinition[]> = {};

  for (const [eventName, definitions] of Object.entries(existingHooks)) {
    const defsToRemove = toRemove[eventName];

    if (!defsToRemove) {
      cleaned[eventName] = definitions;
      continue;
    }

    const removeJson = defsToRemove.map((d) => JSON.stringify(d));
    const filtered = definitions.filter(
      (def) => !removeJson.includes(JSON.stringify(def)),
    );

    if (filtered.length > 0) {
      cleaned[eventName] = filtered;
    }
  }

  return cleaned;
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

/**
 * Collect all definitions and script file names from hook files grouped by target.
 * Filters out hooks with unknown targets or no definitions.
 */
function collectHooksByTarget(hookFiles: ScannedFile[]): Map<string, Array<{ content: ParsedHookContent; path: string }>> {
  const targetIds = getHookTargetIds();
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

  return hooksByTarget;
}

/**
 * Collect all definitions from grouped hooks into a flat map.
 */
function collectAllDefinitions(hooks: Array<{ content: ParsedHookContent }>): Record<string, HookEventDefinition[]> {
  let allDefinitions: Record<string, HookEventDefinition[]> = {};

  for (const { content } of hooks) {
    const events = resolveEventDefinitions(content);
    allDefinitions = mergeHooks(allDefinitions, events as Record<string, HookEventDefinition[]>);
  }

  return allDefinitions;
}

export interface InstallHooksResult {
  installed: number;
  targets: string[];
  copiedFiles: number;
  collisions: string[];
}

/**
 * Install hooks from an artifact into target tool settings.
 *
 * 1. Removes old definitions from settings if artifact was previously installed (prevents duplication)
 * 2. Copies hook script files (non-JSON) to the target's hooks directory as-is
 * 3. Merges hook event definitions into the target's settings file
 */
export function installHooks(
  projectRoot: string,
  artifactId: string,
  hookFiles: ScannedFile[],
): InstallHooksResult {
  const result: InstallHooksResult = { installed: 0, targets: [], copiedFiles: 0, collisions: [] };
  const hooksByTarget = collectHooksByTarget(hookFiles);

  for (const [targetId, hooks] of hooksByTarget) {
    const targetConfig = getHookTarget(targetId);
    if (!targetConfig) continue;

    // Copy script files
    const allCopied: string[] = [];

    for (const { path } of hooks) {
      const { copied, collisions } = copyHookFiles(projectRoot, artifactId, path, targetConfig.hooksDir);
      allCopied.push(...copied);
      result.collisions.push(...collisions);
    }

    result.copiedFiles += allCopied.length;

    // Collect new definitions
    const allDefinitions = collectAllDefinitions(hooks);

    // Remove old definitions first (prevents duplication on re-install/upgrade)
    const settings = readSettingsFile(projectRoot, targetConfig.settingsFile);
    let existingHooks = (settings[targetConfig.hooksKey] ?? {}) as Record<string, HookEventDefinition[]>;
    existingHooks = removeDefinitions(existingHooks, allDefinitions);

    // Merge new definitions
    existingHooks = mergeHooks(existingHooks, allDefinitions);

    settings[targetConfig.hooksKey] = existingHooks;
    writeSettingsFile(projectRoot, targetConfig.settingsFile, settings);
    result.targets.push(targetConfig.displayName);
    result.installed += hooks.length;
  }

  return result;
}

/**
 * Uninstall hooks belonging to an artifact from all target tool settings.
 * The artifact must still be on disk (called before artifact deletion).
 *
 * 1. Removes hook definitions from settings by matching against artifact's hook files
 * 2. Removes copied script files from the target's hooks directory
 */
export function uninstallHooks(
  projectRoot: string,
  artifactId: string,
  hookFiles: ScannedFile[],
): number {
  let removedCount = 0;
  const hooksByTarget = collectHooksByTarget(hookFiles);

  for (const [targetId, hooks] of hooksByTarget) {
    const targetConfig = getHookTarget(targetId);
    if (!targetConfig) continue;

    // Remove definitions from settings
    const settings = readSettingsFile(projectRoot, targetConfig.settingsFile);
    const existingHooks = settings[targetConfig.hooksKey] as Record<string, HookEventDefinition[]> | undefined;

    if (existingHooks) {
      const allDefinitions = collectAllDefinitions(hooks);
      const cleanedHooks = removeDefinitions(existingHooks, allDefinitions);

      if (Object.keys(cleanedHooks).length > 0) {
        settings[targetConfig.hooksKey] = cleanedHooks;
      } else {
        delete settings[targetConfig.hooksKey];
      }

      writeSettingsFile(projectRoot, targetConfig.settingsFile, settings);
    }

    // Remove copied script files
    for (const { path } of hooks) {
      const scriptFiles = listScriptFiles(projectRoot, artifactId, path);
      removeHookFiles(projectRoot, targetConfig.hooksDir, scriptFiles);
    }

    removedCount++;
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
