import { execSync } from "child_process";
import type { ShellExecutor } from "@grekt-labs/cli-engine";

/**
 * Real ShellExecutor implementation using Node.js child_process.
 * Used for running shell commands like tar extraction.
 */
export function createShellExecutor(): ShellExecutor {
  return {
    exec: (command: string) => {
      return execSync(command, { stdio: "pipe" }).toString();
    },
  };
}

/**
 * Singleton instance for convenience.
 */
export const shell = createShellExecutor();
