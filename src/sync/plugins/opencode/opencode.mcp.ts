import type { McpPluginConfig, McpContent } from "#/sync/mcp/mcp.types";

export const opencodeMcpConfig: McpPluginConfig = {
  configFile: "opencode.json",
  serverKey: "mcp",
  transform: (_serverName, content: McpContent, executablePath: string) => {
    if (content.url) {
      return {
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
