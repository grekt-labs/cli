import type { McpPluginConfig, McpTransformFn, McpContent } from "#/sync/mcp/mcp.types";

/**
 * Codex uses TOML format with a slightly different structure:
 * - HTTP servers use `url` and `http_headers` (not `headers`)
 * - Stdio servers use `command` and `args` as usual
 */
const codexMcpTransform: McpTransformFn = (
  _serverName: string,
  content: McpContent,
  executablePath: string,
) => {
  if (content.url) {
    return {
      url: content.url,
      ...(content.headers && { http_headers: content.headers }),
    };
  }

  return {
    command: executablePath,
    ...(content.args?.length && { args: content.args }),
    ...(content.env && { env: content.env }),
  };
};

export const codexMcpConfig: McpPluginConfig = {
  configFile: ".codex/config.toml",
  serverKey: "mcp_servers",
  format: "toml",
  transform: codexMcpTransform,
};
