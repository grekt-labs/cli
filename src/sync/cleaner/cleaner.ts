import { join, resolve, sep } from "path";
import { fs } from "#/context";
import type { CustomTarget } from "@grekt-labs/cli-engine";
import type { TargetPaths } from "#/sync/sync.types";
import { getPlugin } from "#/sync/manager/manager";

export type { TargetPaths };

const DANGEROUS_PATHS = new Set([".", "..", "/", ""]);

/**
 * Check if a path is safe to delete (not root, not project root, not dangerous).
 */
function isSafeToDelete(projectRoot: string, relativePath: string): boolean {
  if (DANGEROUS_PATHS.has(relativePath)) {
    return false;
  }

  const absolutePath = resolve(projectRoot, relativePath);
  const normalizedProjectRoot = resolve(projectRoot);

  if (absolutePath === normalizedProjectRoot) {
    return false;
  }

  if (!absolutePath.startsWith(normalizedProjectRoot + sep)) {
    return false;
  }

  return true;
}

/**
 * Get the paths associated with a target (folder and entry points).
 * Delegates to the plugin's getTargetPaths() method.
 */
export function getTargetPaths(
  targetId: string,
  customTargets?: Record<string, CustomTarget>
): TargetPaths | null {
  try {
    const plugin = getPlugin(targetId, customTargets);
    return plugin.getTargetPaths();
  } catch {
    return null;
  }
}

export interface CleanResult {
  deleted: string[];
  notFound: string[];
}

/**
 * Remove the folders and files associated with a target.
 */
export function cleanTargetPaths(
  projectRoot: string,
  targetId: string,
  customTargets?: Record<string, CustomTarget>
): CleanResult {
  const result: CleanResult = { deleted: [], notFound: [] };

  const paths = getTargetPaths(targetId, customTargets);
  if (!paths) {
    return result;
  }

  const { targetDir, entryPoints } = paths;

  // Delete target directory if it exists and is safe
  if (targetDir && isSafeToDelete(projectRoot, targetDir)) {
    const fullPath = join(projectRoot, targetDir);
    if (fs.exists(fullPath)) {
      fs.rmdir(fullPath, { recursive: true });
      result.deleted.push(targetDir);
    } else {
      result.notFound.push(targetDir);
    }
  }

  // Delete entry point files that are outside the target directory and are safe
  for (const entryPoint of entryPoints) {
    if (!entryPoint || !isSafeToDelete(projectRoot, entryPoint)) continue;

    const isInsideTargetDir = targetDir && entryPoint.startsWith(targetDir + sep);
    if (isInsideTargetDir) continue;

    const fullPath = join(projectRoot, entryPoint);
    if (fs.exists(fullPath)) {
      fs.unlink(fullPath);
      result.deleted.push(entryPoint);
    } else {
      result.notFound.push(entryPoint);
    }
  }

  return result;
}
