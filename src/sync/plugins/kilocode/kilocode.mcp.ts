import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const kilocodeMcpConfig: McpPluginConfig = {
  configFile: ".kilocode/mcp.json",
  serverKey: "mcpServers",
  transform: standardMcpTransform,
};
