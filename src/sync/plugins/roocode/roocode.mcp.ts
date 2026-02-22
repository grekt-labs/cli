import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const roocodeMcpConfig: McpPluginConfig = {
  configFile: ".roo/mcp.json",
  serverKey: "mcpServers",
  transform: standardMcpTransform,
};
