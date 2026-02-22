import type { McpPluginConfig } from "#/sync/mcp/mcp.types";
import { standardMcpTransform } from "#/sync/mcp/mcp.transforms";

export const zedMcpConfig: McpPluginConfig = {
  configFile: ".zed/settings.json",
  serverKey: "context_servers",
  transform: standardMcpTransform,
};
