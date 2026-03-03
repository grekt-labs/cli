/**
 * MCP install/uninstall utilities.
 *
 * MCPs are installed during `grekt add` and removed during `grekt remove`.
 * They modify target tool MCP config files (e.g. .mcp.json, .cursor/mcp.json)
 * by adding/removing server entries in the tool's native format.
 * Completely independent from the sync system.
 *
 * No manifest or external tracking needed — the artifact on disk
 * is the source of truth for both install and uninstall.
 */

import { dirname, join, relative } from "path";
import { fs } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { getMcpConfig, getMcpTargetIds } from "./mcp.config";
import * as TOML from "smol-toml";
import type { ScannedFile } from "@grekt/engine";
import type { McpContent, McpPluginConfig, InstallMcpsResult, McpSummaryEntry } from "./mcp.types";

const SERVER_NAME_SEPARATOR = "--";
const KEY_SEPARATOR = ".";

/**
 * Build a unique server name for an MCP entry.
 * Format: grekt--{artifactId}--{mcpName}
 * This ensures no collisions between artifacts and enables clean uninstall.
 */
function buildServerName(artifactId: string, mcpName: string): string {
  return `grekt${SERVER_NAME_SEPARATOR}${artifactId}${SERVER_NAME_SEPARATOR}${mcpName}`;
}

/**
 * Check if a server name was created by grekt for a specific artifact.
 */
function isOwnedByArtifact(serverName: string, artifactId: string): boolean {
  return serverName.startsWith(`grekt${SERVER_NAME_SEPARATOR}${artifactId}${SERVER_NAME_SEPARATOR}`);
}

/**
 * Get a nested value from an object using a dotted key (e.g. "amp.mcpServers").
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  if (!key.includes(KEY_SEPARATOR)) return obj[key];

  const parts = key.split(KEY_SEPARATOR);
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a nested value on an object using a dotted key (e.g. "amp.mcpServers").
 * Creates intermediate objects as needed.
 */
function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (!key.includes(KEY_SEPARATOR)) {
    obj[key] = value;
    return;
  }

  const parts = key.split(KEY_SEPARATOR);
  const lastPart = parts.pop();
  if (!lastPart) return;

  let current: Record<string, unknown> = obj;
  for (const part of parts) {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[lastPart] = value;
}

/**
 * Delete a nested key from an object using a dotted key.
 * Cleans up empty parent objects.
 */
function deleteNestedValue(obj: Record<string, unknown>, key: string): void {
  if (!key.includes(KEY_SEPARATOR)) {
    delete obj[key];
    return;
  }

  const parts = key.split(KEY_SEPARATOR);
  const lastPart = parts.pop();
  if (!lastPart) return;

  const parents: Array<{ obj: Record<string, unknown>; key: string }> = [];
  let current: Record<string, unknown> = obj;

  for (const part of parts) {
    if (!current[part] || typeof current[part] !== "object") return;
    parents.push({ obj: current, key: part });
    current = current[part] as Record<string, unknown>;
  }

  delete current[lastPart];

  // Clean up empty parent objects
  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i];
    if (!parent) continue;
    const child = parent.obj[parent.key];
    if (typeof child === "object" && child !== null && Object.keys(child).length === 0) {
      delete parent.obj[parent.key];
    }
  }
}

type ConfigFormat = "json" | "toml";

interface ReadConfigOptions {
  projectRoot: string;
  filePath: string;
  format?: ConfigFormat;
}

interface WriteConfigOptions {
  projectRoot: string;
  filePath: string;
  data: Record<string, unknown>;
  format?: ConfigFormat;
}

/**
 * Detect config file format from extension or explicit override.
 */
function resolveFormat(filePath: string, explicit?: ConfigFormat): ConfigFormat {
  if (explicit) return explicit;
  return filePath.endsWith(".toml") ? "toml" : "json";
}

/**
 * Read a config file, returning empty object if it doesn't exist or is invalid.
 * Supports JSON and TOML formats.
 */
function readConfigFile(options: ReadConfigOptions): Record<string, unknown> {
  const fullPath = join(options.projectRoot, options.filePath);

  if (!fs.exists(fullPath)) {
    return {};
  }

  try {
    const raw = fs.readFile(fullPath);
    const format = resolveFormat(options.filePath, options.format);

    if (format === "toml") {
      return TOML.parse(raw) as Record<string, unknown>;
    }

    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Write a config file, creating parent directories if needed.
 * Supports JSON and TOML formats.
 */
function writeConfigFile(options: WriteConfigOptions): void {
  const fullPath = join(options.projectRoot, options.filePath);
  const dir = dirname(fullPath);

  if (!fs.exists(dir)) {
    fs.mkdir(dir, { recursive: true });
  }

  const format = resolveFormat(options.filePath, options.format);

  if (format === "toml") {
    fs.writeFile(fullPath, TOML.stringify(options.data as TOML.TomlPrimitive) + "\n");
    return;
  }

  fs.writeFile(fullPath, JSON.stringify(options.data, null, 2) + "\n");
}

/**
 * Resolve the executable path for a stdio MCP.
 * Returns a relative path from the project root to the MCP's artifact directory.
 */
function resolveExecutablePath(projectRoot: string, artifactId: string, content: McpContent): string {
  if (content.command) {
    const artifactMcpDir = join(projectRoot, ARTIFACTS_DIR, artifactId, "mcps");
    const execPath = join(artifactMcpDir, content.command);
    return relative(projectRoot, execPath);
  }
  return "";
}

/**
 * Extract MCP content and name from a scanned file.
 */
function extractMcpInfo(mcpFile: ScannedFile): { name: string; content: McpContent } {
  const name = mcpFile.parsed.frontmatter["grk-name"] as string;
  const content = mcpFile.parsed.content as McpContent;
  return { name, content };
}

/**
 * Determine the MCP transport type from its content.
 */
function getMcpType(content: McpContent): "http" | "stdio" {
  return content.url ? "http" : "stdio";
}

/**
 * Collect MCP files grouped by target plugin.
 * Only includes targets that have MCP config and are in the active targets list.
 */
function collectTargetConfigs(activeTargets: string[]): Map<string, McpPluginConfig> {
  const targetIds = getMcpTargetIds();
  const configs = new Map<string, McpPluginConfig>();

  for (const targetId of targetIds) {
    if (!activeTargets.includes(targetId)) continue;

    const config = getMcpConfig(targetId);
    if (config) {
      configs.set(targetId, config);
    }
  }

  return configs;
}

/**
 * Install MCPs from an artifact into target tool config files.
 *
 * For each active target that supports MCPs:
 * 1. Reads the tool's MCP config file
 * 2. Removes old entries from this artifact (prevents duplication on re-install)
 * 3. Transforms each MCP to the tool's native format
 * 4. Merges new entries into the config
 * 5. Writes the updated config file
 */
export function installMcps(
  projectRoot: string,
  artifactId: string,
  mcpFiles: ScannedFile[],
  activeTargets: string[],
): InstallMcpsResult {
  const result: InstallMcpsResult = { installed: 0, targets: [] };
  const targetConfigs = collectTargetConfigs(activeTargets);

  if (targetConfigs.size === 0 || mcpFiles.length === 0) {
    return result;
  }

  for (const [targetId, mcpConfig] of targetConfigs) {
    const configData = readConfigFile({ projectRoot, filePath: mcpConfig.configFile, format: mcpConfig.format });
    const servers = (getNestedValue(configData, mcpConfig.serverKey) ?? {}) as Record<string, unknown>;

    // Remove old entries from this artifact (prevents duplication on re-install/upgrade)
    for (const serverName of Object.keys(servers)) {
      if (isOwnedByArtifact(serverName, artifactId)) {
        delete servers[serverName];
      }
    }

    // Add new entries
    for (const mcpFile of mcpFiles) {
      const { name, content } = extractMcpInfo(mcpFile);
      const serverName = buildServerName(artifactId, name);
      const executablePath = resolveExecutablePath(projectRoot, artifactId, content);
      servers[serverName] = mcpConfig.transform(serverName, content, executablePath);
    }

    setNestedValue(configData, mcpConfig.serverKey, servers);
    writeConfigFile({ projectRoot, filePath: mcpConfig.configFile, data: configData, format: mcpConfig.format });
    result.targets.push(targetId);
    result.installed += mcpFiles.length;
  }

  return result;
}

/**
 * Uninstall MCPs belonging to an artifact from all target tool config files.
 * Removes server entries that match the artifact's naming pattern.
 */
export function uninstallMcps(
  projectRoot: string,
  artifactId: string,
  activeTargets: string[],
): number {
  let removedCount = 0;
  const targetConfigs = collectTargetConfigs(activeTargets);

  for (const [_targetId, mcpConfig] of targetConfigs) {
    const configData = readConfigFile({ projectRoot, filePath: mcpConfig.configFile, format: mcpConfig.format });
    const servers = getNestedValue(configData, mcpConfig.serverKey) as Record<string, unknown> | undefined;

    if (!servers) continue;

    let changed = false;
    for (const serverName of Object.keys(servers)) {
      if (isOwnedByArtifact(serverName, artifactId)) {
        delete servers[serverName];
        changed = true;
        removedCount++;
      }
    }

    if (changed) {
      if (Object.keys(servers).length > 0) {
        setNestedValue(configData, mcpConfig.serverKey, servers);
      } else {
        deleteNestedValue(configData, mcpConfig.serverKey);
      }

      writeConfigFile({ projectRoot, filePath: mcpConfig.configFile, data: configData, format: mcpConfig.format });
    }
  }

  return removedCount;
}

/**
 * Get a summary of MCPs for display purposes.
 * Returns a list of MCP names and their transport types.
 */
export function getMcpSummary(mcpFiles: ScannedFile[]): McpSummaryEntry[] {
  return mcpFiles.map((mcpFile) => {
    const { name, content } = extractMcpInfo(mcpFile);
    return { name, type: getMcpType(content) };
  });
}
