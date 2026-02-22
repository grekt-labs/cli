/**
 * MCP distribution types.
 *
 * Each AI tool that supports MCPs has its own config format.
 * McpPluginConfig describes where and how to write MCP entries
 * for a specific tool. The transform function converts the
 * universal format into tool-specific shape.
 */

import type { ScannedFile } from "@grekt-labs/cli-engine";

/** Content parsed from an MCP artifact JSON file (after grk-* fields stripped) */
export interface McpContent {
  /** Command for stdio MCPs */
  command?: string;
  /** Arguments for stdio MCPs */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** URL for HTTP MCPs */
  url?: string;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Allow additional tool-specific properties */
  [key: string]: unknown;
}

/**
 * Transform function that converts universal MCP content
 * into a tool-specific config entry.
 */
export type McpTransformFn = (
  serverName: string,
  content: McpContent,
  executablePath: string,
) => Record<string, unknown>;

/** Configuration for MCP distribution to a specific tool */
export interface McpPluginConfig {
  /** Path to the MCP config file relative to project root */
  configFile: string;
  /** Key for the servers object in the config file */
  serverKey: string;
  /** Config file format (default: "json") */
  format?: "json" | "toml";
  /** Convert universal MCP content to tool-specific format */
  transform: McpTransformFn;
}

export interface InstallMcpsResult {
  installed: number;
  targets: string[];
}

export interface McpSummaryEntry {
  name: string;
  type: "http" | "stdio";
}

/** Scanned MCP files grouped with their artifact ID */
export interface McpInstallContext {
  projectRoot: string;
  artifactId: string;
  mcpFiles: ScannedFile[];
  activeTargets: string[];
}
