/**
 * Hook install/uninstall utilities.
 *
 * Hooks are installed during `grekt add` and removed during `grekt remove`.
 * They modify target tool settings files (e.g. .claude/settings.json)
 * and copy hook script files to the target's hooks directory.
 * Completely independent from the sync system.
 */

import { dirname, join } from "path";
import { fs } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getHookTarget, getHookTargetIds } from "./hooks.config";
import type { ScannedFile } from "@grekt-labs/cli-engine";
import type { ParsedHookContent, HookEventDefinition, HookEventsMap } from "./hooks.types";

/**
 * Manifest file that tracks which hook files were copied by each artifact.
 * Stored in the target's hooks directory (e.g. .claude/hooks/.grekt-hooks.json).
 * Used during uninstall to know which files to remove.
 */
const HOOKS_MANIFEST_FILE = ".grekt-hooks.json";

interface ArtifactHookEntry {
  files: string[];
  definitions: Record<string, HookEventDefinition[]>;
}

interface HooksManifest {
  [artifactId: string]: ArtifactHookEntry;
}

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

function readHooksManifest(projectRoot: string, hooksDir: string): HooksManifest {
  const manifestPath = join(projectRoot, hooksDir, HOOKS_MANIFEST_FILE);

  if (!fs.exists(manifestPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFile(manifestPath));
  } catch {
    return {};
  }
}

function writeHooksManifest(projectRoot: string, hooksDir: string, manifest: HooksManifest): void {
  const fullDir = join(projectRoot, hooksDir);

  if (!fs.exists(fullDir)) {
    fs.mkdir(fullDir, { recursive: true });
  }

  const manifestPath = join(fullDir, HOOKS_MANIFEST_FILE);
  fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
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

  const files = fs.readdir(artifactHooksPath);
  const copied: string[] = [];
  const collisions: string[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) continue;

    const srcPath = join(artifactHooksPath, file);
    const destPath = join(targetHooksPath, file);

    if (!fs.stat(srcPath).isFile) continue;

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
  copiedFiles: number;
  collisions: string[];
}

/**
 * Install hooks from an artifact into target tool settings.
 *
 * 1. Copies hook script files (non-JSON) to the target's hooks directory as-is
 * 2. Merges hook event definitions into the target's settings file
 * 3. Tracks copied files and definitions in a manifest for clean uninstall
 */
export function installHooks(
  projectRoot: string,
  artifactId: string,
  hookFiles: ScannedFile[],
): InstallHooksResult {
  const result: InstallHooksResult = { installed: 0, targets: [], copiedFiles: 0, collisions: [] };
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

  for (const [targetId, hooks] of hooksByTarget) {
    const targetConfig = getHookTarget(targetId);
    if (!targetConfig) continue;

    // Copy script files
    const manifest = readHooksManifest(projectRoot, targetConfig.hooksDir);
    const allCopied: string[] = [];

    for (const { path } of hooks) {
      const { copied, collisions } = copyHookFiles(projectRoot, artifactId, path, targetConfig.hooksDir);
      allCopied.push(...copied);
      result.collisions.push(...collisions);
    }

    result.copiedFiles += allCopied.length;

    // Merge hook definitions into settings (as-is, no path rewriting)
    const settings = readSettingsFile(projectRoot, targetConfig.settingsFile);
    let existingHooks = (settings[targetConfig.hooksKey] ?? {}) as Record<string, HookEventDefinition[]>;
    let allDefinitions: Record<string, HookEventDefinition[]> = {};

    for (const { content } of hooks) {
      const events = resolveEventDefinitions(content);
      const eventDefs = events as Record<string, HookEventDefinition[]>;
      existingHooks = mergeHooks(existingHooks, eventDefs);
      allDefinitions = mergeHooks(allDefinitions, eventDefs);
      result.installed++;
    }

    // Track for uninstall
    const existing = manifest[artifactId];
    manifest[artifactId] = {
      files: [...(existing?.files ?? []), ...allCopied],
      definitions: mergeHooks(existing?.definitions ?? {}, allDefinitions),
    };
    writeHooksManifest(projectRoot, targetConfig.hooksDir, manifest);

    settings[targetConfig.hooksKey] = existingHooks;
    writeSettingsFile(projectRoot, targetConfig.settingsFile, settings);
    result.targets.push(targetConfig.displayName);
  }

  return result;
}

/**
 * Uninstall hooks belonging to an artifact from all target tool settings.
 *
 * 1. Removes copied script files tracked in the manifest
 * 2. Removes hook definitions from settings by matching against stored definitions
 */
export function uninstallHooks(projectRoot: string, artifactId: string): number {
  let removedCount = 0;

  for (const targetId of getHookTargetIds()) {
    const targetConfig = getHookTarget(targetId)!;

    const manifest = readHooksManifest(projectRoot, targetConfig.hooksDir);
    const tracked = manifest[artifactId];

    if (!tracked) continue;

    // Remove copied script files
    if (tracked.files.length > 0) {
      removeHookFiles(projectRoot, targetConfig.hooksDir, tracked.files);
    }

    // Remove hook definitions from settings
    const settings = readSettingsFile(projectRoot, targetConfig.settingsFile);
    const hooks = settings[targetConfig.hooksKey] as Record<string, HookEventDefinition[]> | undefined;

    if (hooks && tracked.definitions) {
      const cleanedHooks: Record<string, HookEventDefinition[]> = {};

      for (const [eventName, definitions] of Object.entries(hooks)) {
        const artifactDefs = tracked.definitions[eventName];

        if (!artifactDefs) {
          cleanedHooks[eventName] = definitions;
          continue;
        }

        const artifactDefsJson = artifactDefs.map((d) => JSON.stringify(d));
        const filtered = definitions.filter(
          (def) => !artifactDefsJson.includes(JSON.stringify(def)),
        );

        if (filtered.length > 0) {
          cleanedHooks[eventName] = filtered;
        }
      }

      if (Object.keys(cleanedHooks).length > 0) {
        settings[targetConfig.hooksKey] = cleanedHooks;
      } else {
        delete settings[targetConfig.hooksKey];
      }

      writeSettingsFile(projectRoot, targetConfig.settingsFile, settings);
    }

    // Clean up manifest
    delete manifest[artifactId];

    if (Object.keys(manifest).length > 0) {
      writeHooksManifest(projectRoot, targetConfig.hooksDir, manifest);
    } else {
      const manifestPath = join(projectRoot, targetConfig.hooksDir, HOOKS_MANIFEST_FILE);
      if (fs.exists(manifestPath)) {
        fs.unlink(manifestPath);
      }
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
