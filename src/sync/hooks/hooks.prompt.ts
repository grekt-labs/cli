/**
 * Interactive hook installation prompt.
 *
 * Encapsulates the full UI flow for hook installation:
 * display summary, ask for confirmation, install, and show results.
 * Keeps commands like `add` and `remove` free of hook-specific UI logic.
 */

import { confirm } from "@inquirer/prompts";
import { success, info, warning, log, newline, colors } from "#/shared/ui/ui";
import { installHooks, getHookSummary } from "./hooks";
import type { ScannedFile } from "@grekt-labs/cli-engine";

/**
 * Show hook summary, ask for confirmation, install hooks, and display results.
 * Returns true if hooks were installed, false if skipped.
 */
export async function promptAndInstallHooks(
  projectRoot: string,
  artifactId: string,
  hookFiles: ScannedFile[],
): Promise<boolean> {
  newline();

  const summary = getHookSummary(hookFiles);

  for (const [targetName, descriptions] of summary) {
    log(`${colors.bold("Hooks")} for ${colors.highlight(targetName)}:`);
    for (const desc of descriptions) {
      log(`  ${colors.dim("-")} ${desc}`);
    }
  }

  newline();

  const shouldInstall = await confirm({
    message: "Install these hooks?",
    default: true,
  });

  if (!shouldInstall) {
    info("Hooks skipped");
    return false;
  }

  const result = installHooks(projectRoot, artifactId, hookFiles);
  success(`Installed ${result.installed} hook(s) for ${result.targets.join(", ")}`);

  if (result.copiedFiles > 0) {
    info(`Copied ${result.copiedFiles} script file(s) to hooks directory`);
  }

  if (result.collisions.length > 0) {
    warning(`Skipped ${result.collisions.length} file(s) that already exist: ${result.collisions.join(", ")}`);
  }

  return true;
}
