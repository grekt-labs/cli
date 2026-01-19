import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { dirname } from "path";
import { parse, stringify } from "yaml";
import {
  GlobalConfigSchema,
  ProjectConfigSchema,
  CredentialsSchema,
  type GlobalConfig,
  type ProjectConfig,
  type Credentials,
} from "#/schemas/index";
import {
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILE,
  GLOBAL_CREDENTIALS_FILE,
  PROJECT_CONFIG_DIR,
  PROJECT_CONFIG_FILE,
} from "#/lib/paths";

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

// Global config
export function getGlobalConfig(): GlobalConfig {
  const raw = readYaml(GLOBAL_CONFIG_FILE, {});
  return GlobalConfigSchema.parse(raw);
}

export function setGlobalConfig(config: Partial<GlobalConfig>): void {
  const current = getGlobalConfig();
  const merged = { ...current, ...config };
  writeYaml(GLOBAL_CONFIG_FILE, merged);
}

export function setGlobalConfigValue(key: keyof GlobalConfig, value: unknown): void {
  const current = getGlobalConfig();
  (current as Record<string, unknown>)[key] = value;
  writeYaml(GLOBAL_CONFIG_FILE, current);
}

// Project config
export function getProjectConfig(projectRoot: string = process.cwd()): ProjectConfig {
  const filepath = `${projectRoot}/${PROJECT_CONFIG_FILE}`;
  const raw = readYaml(filepath, {});
  return ProjectConfigSchema.parse(raw);
}

export function setProjectConfig(config: Partial<ProjectConfig>, projectRoot: string = process.cwd()): void {
  const filepath = `${projectRoot}/${PROJECT_CONFIG_FILE}`;
  const current = existsSync(filepath) ? getProjectConfig(projectRoot) : {};
  const merged = { ...current, ...config };
  writeYaml(filepath, merged);
}

// Credentials
export function getCredentials(): Credentials {
  const raw = readYaml(GLOBAL_CREDENTIALS_FILE, {});
  return CredentialsSchema.parse(raw);
}

export function setCredential(registryUrl: string, token: string): void {
  const current = getCredentials();
  current[registryUrl] = { token };
  writeYaml(GLOBAL_CREDENTIALS_FILE, current, true);
}

export function getToken(registryUrl: string): string | null {
  const creds = getCredentials();
  return creds[registryUrl]?.token ?? null;
}

export function removeCredential(registryUrl: string): void {
  const current = getCredentials();
  delete current[registryUrl];
  writeYaml(GLOBAL_CREDENTIALS_FILE, current, true);
}

// Check if grekt is initialized in current directory
export function isInitialized(projectRoot: string = process.cwd()): boolean {
  return existsSync(`${projectRoot}/${PROJECT_CONFIG_DIR}`);
}

// Ensure global config dir exists
export function ensureGlobalConfigDir(): void {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
}
