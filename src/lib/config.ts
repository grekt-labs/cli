import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { dirname } from "path";
import { parse, stringify } from "yaml";
import {
  ProjectConfigSchema,
  LocalConfigSchema,
  type ProjectConfig,
  type LocalConfig,
} from "#/schemas/index";
import {
  GLOBAL_CONFIG_DIR,
  GREKT_YAML,
  GREKT_DIR,
} from "#/lib/paths";

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

// Ensure global config dir exists (for credentials)
export function ensureGlobalConfigDir(): void {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
}

// Local config (.grekt/config.yaml) - gitignored, contains registry configs
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
  writeYaml(filepath, config, true); // secure = true (chmod 600)
}

export function getLocalConfigPath(projectRoot: string = process.cwd()): string {
  return `${projectRoot}/${GREKT_DIR}/${LOCAL_CONFIG_FILE}`;
}
