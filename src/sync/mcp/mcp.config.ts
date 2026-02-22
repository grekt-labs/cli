/**
 * MCP config registry.
 *
 * Maps plugin IDs to their MCP distribution config.
 * Configs are defined in each plugin — this file just collects them.
 * Adding MCP support to a new tool: create a .mcp.ts in the plugin folder,
 * export the config, and add the import here.
 */

import type { McpPluginConfig } from "./mcp.types";

// Full plugins
import { claudeMcpConfig } from "#/sync/plugins/claude/claude.mcp";
import { cursorMcpConfig } from "#/sync/plugins/cursor/cursor.mcp";
import { copilotMcpConfig } from "#/sync/plugins/copilot/copilot.mcp";
import { amazonqMcpConfig } from "#/sync/plugins/amazonq/amazonq.mcp";
import { opencodeMcpConfig } from "#/sync/plugins/opencode/opencode.mcp";
import { kiroMcpConfig } from "#/sync/plugins/kiro/kiro.mcp";

// Thin plugins with MCP support
import { geminiMcpConfig } from "#/sync/plugins/gemini/gemini.mcp";
import { roocodeMcpConfig } from "#/sync/plugins/roocode/roocode.mcp";
import { kilocodeMcpConfig } from "#/sync/plugins/kilocode/kilocode.mcp";
import { ampMcpConfig } from "#/sync/plugins/amp/amp.mcp";

const MCP_CONFIGS: Record<string, McpPluginConfig> = {
  claude: claudeMcpConfig,
  cursor: cursorMcpConfig,
  copilot: copilotMcpConfig,
  amazonq: amazonqMcpConfig,
  opencode: opencodeMcpConfig,
  kiro: kiroMcpConfig,
  gemini: geminiMcpConfig,
  roocode: roocodeMcpConfig,
  kilocode: kilocodeMcpConfig,
  amp: ampMcpConfig,
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
