import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const ampMcpConfig: McpPluginConfig = {
  configFile: ".amp/settings.json",
  serverKey: "amp.mcpServers",
  transform: standardMcpTransform,
};
