/**
 * MCP config registry.
 *
 * Maps plugin IDs to their MCP distribution config.
 * Configs are defined in each plugin — this file just collects them.
 * Adding MCP support to a new tool: create a .mcp.ts in the plugin folder,
 * export the config, and add the import here.
 */

import type { McpPluginConfig } from "./mcp.types";

import { claudeMcpConfig } from "#/sync/plugins/claude/claude.mcp";
import { cursorMcpConfig } from "#/sync/plugins/cursor/cursor.mcp";
import { copilotMcpConfig } from "#/sync/plugins/copilot/copilot.mcp";
import { amazonqMcpConfig } from "#/sync/plugins/amazonq/amazonq.mcp";
import { opencodeMcpConfig } from "#/sync/plugins/opencode/opencode.mcp";
import { kiroMcpConfig } from "#/sync/plugins/kiro/kiro.mcp";

const MCP_CONFIGS: Record<string, McpPluginConfig> = {
  claude: claudeMcpConfig,
  cursor: cursorMcpConfig,
  copilot: copilotMcpConfig,
  amazonq: amazonqMcpConfig,
  opencode: opencodeMcpConfig,
  kiro: kiroMcpConfig,
};

export function getMcpConfig(targetId: string): McpPluginConfig | undefined {
  return MCP_CONFIGS[targetId];
}

export function getMcpTargetIds(): string[] {
  return Object.keys(MCP_CONFIGS);
}

export function hasMcpSupport(targetId: string): boolean {
  return targetId in MCP_CONFIGS;
}
