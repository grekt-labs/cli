/**
 * Shared MCP transform functions.
 *
 * Tools with standard MCP format can reuse standardMcpTransform
 * instead of writing their own transform function.
 */

import type { McpTransformFn, McpContent } from "./mcp.types";

/**
 * Standard transform for tools with the common MCP server format.
 * Works for Cursor, Amazon Q, and similar tools that use
 * { url } for HTTP and { command, args } for stdio.
 */
export const standardMcpTransform: McpTransformFn = (
  _serverName: string,
  content: McpContent,
  executablePath: string,
) => {
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
};
