import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const kiroMcpConfig: McpPluginConfig = {
  configFile: ".kiro/settings/mcp.json",
  serverKey: "mcpServers",
  transform: standardMcpTransform,
};
