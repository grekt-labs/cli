import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { dirname } from "path";
import { parse, stringify } from "yaml";
import {
  GrektYamlSchema,
  CredentialsSchema,
  type GrektYaml,
  type Credentials,
} from "#/schemas/index";
import {
  GLOBAL_CONFIG_DIR,
  GLOBAL_CREDENTIALS_FILE,
  GREKT_YAML,
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

// Project config (grekt.yaml)
export function getConfig(projectRoot: string = process.cwd()): GrektYaml {
  const filepath = `${projectRoot}/${GREKT_YAML}`;
  const raw = readYaml(filepath, {});
  return GrektYamlSchema.parse(raw);
}

export function saveConfig(config: GrektYaml, projectRoot: string = process.cwd()): void {
  const filepath = `${projectRoot}/${GREKT_YAML}`;
  writeYaml(filepath, config);
}

export function setConfigValue(key: keyof GrektYaml, value: unknown, projectRoot: string = process.cwd()): void {
  const current = getConfig(projectRoot);
  (current as Record<string, unknown>)[key] = value;
  saveConfig(current, projectRoot);
}

// Credentials (stored globally for registry auth)
export function getCredentials(): Credentials {
  const raw = readYaml(GLOBAL_CREDENTIALS_FILE, {});
  return CredentialsSchema.parse(raw);
}

export function setCredential(registryUrl: string, token: string): void {
  ensureGlobalConfigDir();
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
