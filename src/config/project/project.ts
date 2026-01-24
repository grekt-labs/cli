import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { dirname } from "path";
import { parse, stringify } from "yaml";
import {
  ProjectConfigSchema,
  LocalConfigSchema,
  type ProjectConfig,
  type LocalConfig,
  type StoredSession,
} from "#/schemas/index";
import {
  GREKT_YAML,
  GREKT_DIR,
} from "#/config/paths/paths";

// Local config file path (inside .grekt/ directory)
const LOCAL_CONFIG_FILE = "config.yaml";

function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readYaml<T>(filepath: string, defaultValue: T): T {
  if (!existsSync(filepath)) {
    return defaultValue;
  }
  const content = readFileSync(filepath, "utf-8");
  return parse(content) as T;
}

function writeYaml(filepath: string, data: unknown, secure = false): void {
  ensureDir(filepath);
  const content = stringify(data);
  writeFileSync(filepath, content, "utf-8");
  if (secure) {
    chmodSync(filepath, 0o600);
  }
}

// Project config (grekt.yaml)
export function getConfig(projectRoot: string = process.cwd()): ProjectConfig {
  const filepath = `${projectRoot}/${GREKT_YAML}`;
  const raw = readYaml(filepath, {});
  return ProjectConfigSchema.parse(raw);
}

export function saveConfig(config: ProjectConfig, projectRoot: string = process.cwd()): void {
  const filepath = `${projectRoot}/${GREKT_YAML}`;
  writeYaml(filepath, config);
}

export function setConfigValue(key: keyof ProjectConfig, value: unknown, projectRoot: string = process.cwd()): void {
  const current = getConfig(projectRoot);
  (current as Record<string, unknown>)[key] = value;
  saveConfig(current, projectRoot);
}

// Check if grekt is initialized
export function isInitialized(projectRoot: string = process.cwd()): boolean {
  return existsSync(`${projectRoot}/${GREKT_YAML}`);
}

// Local config (.grekt/config.yaml) - gitignored, contains registry configs, session, and tokens
export function getLocalConfig(projectRoot: string = process.cwd()): LocalConfig | null {
  const filepath = `${projectRoot}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;
  if (!existsSync(filepath)) {
    return null;
  }
  const raw = readYaml(filepath, {});
  return LocalConfigSchema.parse(raw);
}

export function saveLocalConfig(config: LocalConfig, projectRoot: string = process.cwd()): void {
  const filepath = `${projectRoot}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;
  writeLocalConfigWithComments(filepath, config);
}

export function getLocalConfigPath(projectRoot: string = process.cwd()): string {
  return `${projectRoot}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;
}

// Generate YAML with helpful comments for self-documentation
function writeLocalConfigWithComments(filepath: string, config: LocalConfig): void {
  ensureDir(filepath);

  const lines: string[] = [];

  // Registries section
  if (config.registries && Object.keys(config.registries).length > 0) {
    lines.push("# Registry backends for artifacts with scope (@scope/name)");
    lines.push("# Each scope can point to a different backend (GitLab, etc.)");
    lines.push("registries:");
    for (const [scope, entry] of Object.entries(config.registries)) {
      lines.push(`  "${scope}":`);
      lines.push(`    type: ${entry.type}`);
      if (entry.project) lines.push(`    project: ${entry.project}`);
      if (entry.host) lines.push(`    host: ${entry.host}`);
      if (entry.token) lines.push(`    token: ${entry.token}`);
    }
    lines.push("");
  }

  // Session section
  if (config.session) {
    lines.push("# Session for the public registry (grekt login)");
    lines.push("# Generated automatically by grekt login");
    lines.push("session:");
    lines.push(`  access_token: ${config.session.access_token}`);
    lines.push(`  refresh_token: ${config.session.refresh_token}`);
    if (config.session.expires_at !== undefined) {
      lines.push(`  expires_at: ${config.session.expires_at}`);
    }
    lines.push("");
  }

  // Tokens section
  if (config.tokens && Object.keys(config.tokens).length > 0) {
    lines.push("# Tokens for git sources (github:owner/repo, gitlab:owner/repo)");
    lines.push("# Only needed for private repos");
    lines.push("tokens:");
    for (const [name, token] of Object.entries(config.tokens)) {
      lines.push(`  ${name}: ${token}`);
    }
    lines.push("");
  }

  const content = lines.length > 0 ? lines.join("\n") : "";
  writeFileSync(filepath, content, "utf-8");
  chmodSync(filepath, 0o600);
}

// Session management
export function getSession(projectRoot: string = process.cwd()): StoredSession | null {
  const config = getLocalConfig(projectRoot);
  return config?.session ?? null;
}

export function saveSession(session: StoredSession, projectRoot: string = process.cwd()): void {
  const config = getLocalConfig(projectRoot) ?? {};
  config.session = session;
  saveLocalConfig(config, projectRoot);
}

export function clearSession(projectRoot: string = process.cwd()): void {
  const config = getLocalConfig(projectRoot);
  if (config) {
    delete config.session;
    saveLocalConfig(config, projectRoot);
  }
}

// Token management for git sources
export function getToken(name: string, projectRoot: string = process.cwd()): string | undefined {
  const config = getLocalConfig(projectRoot);
  return config?.tokens?.[name];
}

export function setToken(name: string, token: string, projectRoot: string = process.cwd()): void {
  const config = getLocalConfig(projectRoot) ?? {};
  if (!config.tokens) {
    config.tokens = {};
  }
  config.tokens[name] = token;
  saveLocalConfig(config, projectRoot);
}

export function removeToken(name: string, projectRoot: string = process.cwd()): void {
  const config = getLocalConfig(projectRoot);
  if (config?.tokens) {
    delete config.tokens[name];
    saveLocalConfig(config, projectRoot);
  }
}
