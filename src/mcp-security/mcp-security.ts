/**
 * MCP security scanning.
 *
 * Scans MCP artifact files for prompt injection, exfiltration,
 * privilege escalation, and other threats using mcp-guardian patterns.
 *
 * Integrates into grekt scan: enriches an existing SecurityReport
 * with MCP-specific findings when the artifact contains MCP servers.
 */

import {
  scanToolDescription,
} from "mcp-guardian";
import type { ScannedFile, SecurityReport, SecurityFinding } from "@grekt/engine";
import { scanArtifact } from "#/context";

type FindingSeverity = SecurityFinding["severity"];

/** Shape of MCP content after JSON parsing. Engine types it as `unknown`. */
interface McpFileContent {
  name?: string;
  description?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  mcpServers?: Record<string, McpServerEntry>;
}

interface McpServerEntry {
  name?: string;
  description?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface ExtractedServer {
  name: string;
  description: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

const SEVERITY_MAP: Record<string, FindingSeverity> = {
  critical: "critical",
  warning: "medium",
  info: "info",
};

const DEDUCTION_MAP: Record<string, number> = {
  critical: 15,
  warning: 5,
  info: 0,
};

/**
 * Enrich a SecurityReport with MCP-specific findings.
 * If the artifact has no MCPs, returns the report unchanged.
 */
export function enrichReportWithMcpFindings(
  report: SecurityReport,
  artifactDir: string,
): SecurityReport {
  const artifactInfo = scanArtifact(artifactDir);
  if (!artifactInfo?.mcps || artifactInfo.mcps.length === 0) return report;

  const mcpFindings = scanMcpFiles(artifactInfo.mcps);
  if (mcpFindings.length === 0) return report;

  const totalDeduction = mcpFindings.reduce((sum, f) => sum + f.deduction, 0);
  const newScore = Math.max(0, report.score - totalDeduction);
  const allFindings = [...report.findings, ...mcpFindings];

  return {
    ...report,
    score: newScore,
    badge: determineBadge(newScore, allFindings),
    findings: allFindings,
  };
}

/**
 * Extract server entries from an MCP file.
 * Supports both flat format ({ name, description, command }) and
 * mcpServers wrapper ({ mcpServers: { serverName: { description, command } } }).
 */
function extractServers(mcpFile: ScannedFile): ExtractedServer[] {
  const content = mcpFile.parsed.content as McpFileContent;
  const fm = mcpFile.parsed.frontmatter;

  // mcpServers wrapper format
  if (content.mcpServers && typeof content.mcpServers === "object") {
    return Object.entries(content.mcpServers).map(([key, entry]) => ({
      name: entry.name ?? key,
      description: entry.description ?? "",
      command: entry.command,
      args: entry.args,
      url: entry.url,
      env: entry.env,
    }));
  }

  // Flat format — fields in content, fallback to frontmatter
  const name = content.name ?? fm["grk-name"] ?? "unknown";
  const description = content.description ?? fm["grk-description"] ?? "";

  return [{
    name,
    description,
    command: content.command,
    args: content.args,
    url: content.url,
    env: content.env,
  }];
}

/**
 * Scan MCP files from an artifact for security issues.
 */
function scanMcpFiles(mcpFiles: ScannedFile[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const mcpFile of mcpFiles) {
    for (const server of extractServers(mcpFile)) {
      if (server.description) {
        findings.push(...scanText(server.name, server.description, "description"));
      }

      const commandLine = [server.command, ...(server.args ?? [])].filter(Boolean).join(" ");
      if (commandLine) {
        findings.push(...scanText(server.name, commandLine, "command"));
      }

      if (server.url) {
        findings.push(...scanText(server.name, server.url, "endpoint"));
      }

      if (server.env) {
        const envValues = Object.values(server.env).join(" ");
        if (envValues.trim()) {
          findings.push(...scanText(server.name, envValues, "env"));
        }
      }
    }
  }

  return findings;
}

/**
 * Scan a text string using mcp-guardian and convert to SecurityFindings.
 */
function scanText(
  serverName: string,
  text: string,
  source: string,
): SecurityFinding[] {
  const result = scanToolDescription(serverName, text);
  if (result.status === "clean") return [];

  return result.issues.map((issue) => ({
    id: `mcp-${source}-${issue.pattern}`,
    category: "mcp-security",
    severity: SEVERITY_MAP[issue.severity] ?? "medium",
    title: `${issue.pattern} in MCP ${source} "${serverName}"`,
    description: `Pattern "${issue.pattern}" found in MCP server ${source}`,
    evidence: issue.match,
    deduction: DEDUCTION_MAP[issue.severity] ?? 5,
    recommendation: recommendationForPattern(issue.pattern),
  }));
}

/**
 * Re-determine badge from score + findings.
 * Mirrors the engine's determineBadge logic.
 */
function determineBadge(
  score: number,
  findings: SecurityFinding[],
): SecurityReport["badge"] {
  const hasCritical = findings.some((f) => f.severity === "critical");
  const highCount = findings.filter((f) => f.severity === "high").length;

  if (hasCritical) return "rejected";
  if (score < 50) return "rejected";
  if (score < 75) return "suspicious";
  if (score < 90 && highCount <= 2) return "conditional";
  if (score >= 90 && highCount === 0) return "certified";
  if (highCount > 2) return "suspicious";
  if (highCount > 0) return "conditional";
  return "certified";
}

function recommendationForPattern(pattern: string): string {
  switch (pattern) {
    case "cross_tool_instruction":
      return "Review MCP for cross-tool instruction injection. Tools should not instruct the model to call other tools.";
    case "privilege_escalation":
      return "Review MCP for privilege escalation attempts. Remove any instructions that override system prompts.";
    case "exfiltration":
      return "Review MCP for data exfiltration vectors. Verify all URLs are legitimate and expected.";
    case "sensitive_path":
      return "Review MCP for references to sensitive file paths. Ensure access to credentials and keys is intentional.";
    case "encoded_content":
      return "Review MCP for encoded/obfuscated content. Legitimate tools rarely use base64 or unicode escapes in descriptions.";
    default:
      return "Review MCP server configuration for potential security issues.";
  }
}
