import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const amazonqMcpConfig: McpPluginConfig = {
  configFile: ".amazonq/mcp.json",
  serverKey: "mcpServers",
  transform: standardMcpTransform,
};
