import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const geminiMcpConfig: McpPluginConfig = {
  configFile: ".gemini/settings.json",
  serverKey: "mcpServers",
  transform: standardMcpTransform,
};
