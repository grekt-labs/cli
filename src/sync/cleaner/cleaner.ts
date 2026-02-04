import { dirname, join } from "path";
import { fs } from "#/context";
import type { CustomTarget } from "@grekt-labs/cli-engine";

export interface TargetPaths {
  targetDir: string;
  contextEntryPoint: string;
}

const builtInTargetPaths: Record<string, TargetPaths> = {
  claude: {
    targetDir: ".claude",
    contextEntryPoint: ".claude/CLAUDE.md",
  },
  cursor: {
    targetDir: "",
    contextEntryPoint: ".cursorrules",
  },
  opencode: {
    targetDir: ".opencode",
    contextEntryPoint: "",
  },
};

/**
 * Get the paths associated with a target (folder and entry point).
 */
export function getTargetPaths(
  targetId: string,
  customTargets?: Record<string, CustomTarget>
): TargetPaths | null {
  const builtIn = builtInTargetPaths[targetId];
  if (builtIn) {
    return builtIn;
  }

  const customTarget = customTargets?.[targetId];
  if (customTarget) {
    const targetDir = customTarget.paths
      ? dirname(customTarget.contextEntryPoint)
      : targetId;

    return {
      targetDir,
      contextEntryPoint: customTarget.contextEntryPoint,
    };
  }

  return null;
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

  const { targetDir, contextEntryPoint } = paths;

  // Delete target directory if it exists
  if (targetDir) {
    const fullPath = join(projectRoot, targetDir);
    if (fs.exists(fullPath)) {
      fs.rmdir(fullPath, { recursive: true });
      result.deleted.push(targetDir);
    } else {
      result.notFound.push(targetDir);
    }
  }

  // Delete context entry point if it's outside the target directory
  if (contextEntryPoint) {
    const isInsideTargetDir = targetDir && contextEntryPoint.startsWith(targetDir + "/");

    if (!isInsideTargetDir) {
      const fullPath = join(projectRoot, contextEntryPoint);
      if (fs.exists(fullPath)) {
        fs.unlink(fullPath);
        result.deleted.push(contextEntryPoint);
      } else {
        result.notFound.push(contextEntryPoint);
      }
    }
  }

  return result;
}
