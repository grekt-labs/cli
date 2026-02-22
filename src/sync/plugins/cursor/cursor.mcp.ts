import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const cursorMcpConfig: McpPluginConfig = {
  configFile: ".cursor/mcp.json",
  serverKey: "mcpServers",
  transform: standardMcpTransform,
};
