import { execFileSync } from "child_process";
import type { ShellExecutor } from "@grekt-labs/cli-engine";

/**
 * Real ShellExecutor implementation using Node.js child_process.
 * Uses execFileSync to prevent shell injection - arguments are passed directly
 * to the executable without shell interpretation.
 */
export function createShellExecutor(): ShellExecutor {
  return {
    execFile: (command: string, args: string[]) => {
      return execFileSync(command, args, { stdio: "pipe" }).toString();
    },
  };
}

/**
 * Singleton instance for convenience.
 */
export const shell = createShellExecutor();
