import type { McpPluginConfig, McpContent } from "#/sync/mcp/mcp.types";

export const claudeMcpConfig: McpPluginConfig = {
  configFile: ".mcp.json",
  serverKey: "mcpServers",
  transform: (_serverName, content: McpContent, executablePath: string) => {
    if (content.url) {
      return {
        type: "http",
        url: content.url,
        ...(content.headers && { headers: content.headers }),
      };
    }

    return {
      command: executablePath,
      ...(content.args?.length && { args: content.args }),
      ...(content.env && { env: content.env }),
    };
  },
};
