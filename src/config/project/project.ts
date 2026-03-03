import { dirname, resolve } from "path";
import { stringify } from "yaml";
import { fs } from "#/context";
import {
  ProjectConfigSchema,
  LocalConfigSchema,
  safeParseYaml,
  type ProjectConfig,
  type LocalConfig,
} from "@grekt/engine";
import {
  GREKT_YAML,
  GREKT_DIR,
} from "#/config/paths/paths";
import { ensureDir } from "#/shared/filesystem/filesystem";
import { warning } from "#/shared/ui/ui";

// Local config file path (inside .grekt/ directory)
const LOCAL_CONFIG_FILE = "config.yaml";

function writeYaml(filepath: string, data: unknown, secure = false): void {
  ensureDir(filepath);
  const content = stringify(data);
  fs.writeFile(filepath, content);
  if (secure) {
    fs.chmod(filepath, 0o600);
  }
}

// Project config (grekt.yaml)
export function getConfig(projectRoot: string = process.cwd()): ProjectConfig {
  const filepath = `${projectRoot}/${GREKT_YAML}`;
  if (!fs.exists(filepath)) {
    // Return empty config if file doesn't exist (will be validated by schema)
    const result = safeParseYaml("{}", ProjectConfigSchema, filepath);
    if (!result.success) {
      const details = result.error.details?.join("\n  ") ?? "";
      throw new Error(`${result.error.message}${details ? `\n  ${details}` : ""}`);
    }
    return result.data;
  }
  const content = fs.readFile(filepath);
  const result = safeParseYaml(content, ProjectConfigSchema, filepath);
  if (!result.success) {
    const details = result.error.details?.join("\n  ") ?? "";
    throw new Error(`${result.error.message}${details ? `\n  ${details}` : ""}`);
  }
  return result.data;
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
  return fs.exists(`${projectRoot}/${GREKT_YAML}`);
}

// Walk up directory tree to find .grekt/config.yaml
function findLocalConfigPath(startDir: string): string | null {
  let current = resolve(startDir);

  while (true) {
    const configPath = `${current}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;

    if (fs.exists(configPath)) {
      return configPath;
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }

    current = parent;
  }
}

// Local config (.grekt/config.yaml) - gitignored, contains registry configs, session, and tokens
// Walks up directory tree to find config (supports monorepos)
export function getLocalConfig(projectRoot: string = process.cwd()): LocalConfig | null {
  const filepath = findLocalConfigPath(projectRoot);
  if (!filepath) {
    return null;
  }
  const content = fs.readFile(filepath);

  // Empty config file — warn and treat as fresh config
  if (!content.trim()) {
    warning(`Empty .grekt/config.yaml found at ${filepath}. Using default configuration.`);
    return {};
  }

  const result = safeParseYaml(content, LocalConfigSchema, filepath);
  if (!result.success) {
    warning(`Malformed .grekt/config.yaml found at ${filepath}. Please review or regenerate it.`);
    return {};
  }
  return result.data;
}

export function saveLocalConfig(config: LocalConfig, projectRoot: string = process.cwd()): void {
  const filepath = `${projectRoot}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;
  writeLocalConfigWithComments(filepath, config);
}

export function getLocalConfigPath(projectRoot: string = process.cwd()): string {
  // Return existing config path if found, otherwise default to projectRoot
  return findLocalConfigPath(projectRoot) ?? `${projectRoot}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;
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

  const content = lines.length > 0 ? lines.join("\n") : "{}\n";
  fs.writeFile(filepath, content);
  fs.chmod(filepath, 0o600);
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

// Registry management for scoped artifacts
export function getRegistry(scope: string, projectRoot: string = process.cwd()): LocalConfig["registries"] extends Record<string, infer T> | undefined ? T | undefined : never {
  const config = getLocalConfig(projectRoot);
  return config?.registries?.[scope];
}

export function setRegistry(scope: string, entry: NonNullable<LocalConfig["registries"]>[string], projectRoot: string = process.cwd()): void {
  const config = getLocalConfig(projectRoot) ?? {};
  if (!config.registries) {
    config.registries = {};
  }
  config.registries[scope] = entry;
  saveLocalConfig(config, projectRoot);
}

export function removeRegistry(scope: string, projectRoot: string = process.cwd()): void {
  const config = getLocalConfig(projectRoot);
  if (config?.registries) {
    delete config.registries[scope];
    saveLocalConfig(config, projectRoot);
  }
}
