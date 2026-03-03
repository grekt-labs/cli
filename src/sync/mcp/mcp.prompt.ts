/**
 * Interactive MCP installation prompt.
 *
 * Encapsulates the full UI flow for MCP installation:
 * display summary, ask for confirmation, install, and show results.
 * Keeps commands like `add` and `remove` free of MCP-specific UI logic.
 */

import { confirm } from "@inquirer/prompts";
import { success, info, log, newline, colors } from "#/shared/ui/ui";
import { installMcps, getMcpSummary } from "./mcp";
import type { ScannedFile } from "@grekt/engine";

/**
 * Show MCP summary, ask for confirmation, install MCPs, and display results.
 * Returns true if MCPs were installed, false if skipped.
 */
export async function promptAndInstallMcps(
  projectRoot: string,
  artifactId: string,
  mcpFiles: ScannedFile[],
  activeTargets: string[],
): Promise<boolean> {
  newline();

  const summary = getMcpSummary(mcpFiles);

  log(`${colors.bold("MCP servers")} to install:`);
  for (const entry of summary) {
    const typeLabel = colors.dim(`(${entry.type})`);
    log(`  ${colors.dim("-")} ${entry.name} ${typeLabel}`);
  }

  newline();

  const shouldInstall = await confirm({
    message: "Install these MCP servers?",
    default: true,
  });

  if (!shouldInstall) {
    info("MCP servers skipped");
    return false;
  }

  const result = installMcps(projectRoot, artifactId, mcpFiles, activeTargets);

  if (result.installed > 0) {
    success(`Installed ${summary.length} MCP server(s) for ${result.targets.join(", ")}`);
  } else {
    info("No active targets support MCP distribution");
  }

  return result.installed > 0;
}
