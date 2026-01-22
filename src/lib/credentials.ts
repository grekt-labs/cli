import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parse, stringify } from "yaml";
import { CredentialsSchema, type Credentials, type S3Credentials, type TokenCredentials, type ApiCredentials } from "#/schemas/index";
import { getConfig } from "#/lib/config";
import { DEFAULT_REGISTRY } from "#/lib/paths";

const GREKT_HOME = join(homedir(), ".grekt");
const CREDENTIALS_FILE = join(GREKT_HOME, "credentials.yaml");

export function getCredentialsPath(): string {
  return CREDENTIALS_FILE;
}

export function credentialsExist(): boolean {
  return existsSync(CREDENTIALS_FILE);
}

export function getCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_FILE)) {
    return {};
  }
  const content = readFileSync(CREDENTIALS_FILE, "utf-8");
  const raw = parse(content);
  return CredentialsSchema.parse(raw);
}

export function saveCredentials(data: Credentials): void {
  if (!existsSync(GREKT_HOME)) {
    mkdirSync(GREKT_HOME, { recursive: true });
  }
  const content = stringify(data);
  writeFileSync(CREDENTIALS_FILE, content, { mode: 0o600 }); // Secure permissions
}

export function getRegistryCredentials(registryName: string): S3Credentials | undefined {
  const credentials = getCredentials();
  const cred = credentials[registryName];
  if (cred && "type" in cred && cred.type === "s3") {
    return cred;
  }
  return undefined;
}

export function setRegistryCredentials(registryName: string, creds: S3Credentials): void {
  const credentials = getCredentials();
  credentials[registryName] = creds;
  saveCredentials(credentials);
}

export function getTokenCredentials(name: string): string | undefined {
  const credentials = getCredentials();
  const cred = credentials[name];
  if (cred && "token" in cred) {
    return cred.token;
  }
  return undefined;
}

export function setTokenCredentials(name: string, token: string): void {
  const credentials = getCredentials();
  credentials[name] = { token };
  saveCredentials(credentials);
}

/**
 * Get S3 credentials from env vars (fallback for CI/CD)
 */
export function getCredentialsFromEnv(): S3Credentials | undefined {
  const {
    GREKT_STORAGE_ENDPOINT,
    GREKT_STORAGE_ACCESS_KEY_ID,
    GREKT_STORAGE_SECRET_ACCESS_KEY,
    GREKT_STORAGE_BUCKET,
    GREKT_STORAGE_PUBLIC_URL,
    // Legacy env vars (backwards compat)
    STORAGE_ENDPOINT,
    STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY,
    STORAGE_BUCKET,
    STORAGE_PUBLIC_URL,
  } = process.env;

  const endpoint = GREKT_STORAGE_ENDPOINT || STORAGE_ENDPOINT;
  const accessKeyId = GREKT_STORAGE_ACCESS_KEY_ID || STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = GREKT_STORAGE_SECRET_ACCESS_KEY || STORAGE_SECRET_ACCESS_KEY;
  const bucket = GREKT_STORAGE_BUCKET || STORAGE_BUCKET;
  const publicUrl = GREKT_STORAGE_PUBLIC_URL || STORAGE_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return undefined;
  }

  return {
    type: "s3",
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
  };
}

// ============================================================================
// Registry Token Management (for API-based registries)
// ============================================================================

/**
 * Get registry token. Priority: GREKT_TOKEN env > credentials.yaml
 */
export function getRegistryToken(): string | undefined {
  // 1. Env var (CI/CD) - never persisted, logout doesn't affect it
  const envToken = process.env.GREKT_TOKEN;
  if (envToken) return envToken;

  // 2. Credentials file
  const credentials = getCredentials();
  const defaultCred = credentials.default;
  if (defaultCred && "url" in defaultCred && "token" in defaultCred) {
    return defaultCred.token;
  }

  return undefined;
}

/**
 * Save registry token (only for login, not for env)
 */
export function setRegistryToken(token: string, url: string): void {
  const credentials = getCredentials();
  credentials.default = { url, token } as ApiCredentials;
  saveCredentials(credentials);
}

/**
 * Remove registry token (only affects credentials.yaml, not env)
 */
export function removeRegistryToken(): void {
  const credentials = getCredentials();
  delete credentials.default;
  saveCredentials(credentials);
}

/**
 * Get registry URL. Priority: project config > credentials.yaml > default
 */
export function getRegistryUrl(projectRoot?: string): string {
  // 1. Project config
  try {
    const config = getConfig(projectRoot);
    if (config.registry) return config.registry;
  } catch {
    // Config might not exist (e.g., global commands like whoami)
  }

  // 2. Credentials file
  const credentials = getCredentials();
  const defaultCred = credentials.default;
  if (defaultCred && "url" in defaultCred) {
    return defaultCred.url;
  }

  // 3. Default
  return DEFAULT_REGISTRY;
}

/**
 * Get API credentials for the default registry
 */
export function getApiCredentials(): ApiCredentials | undefined {
  const credentials = getCredentials();
  const defaultCred = credentials.default;
  if (defaultCred && "url" in defaultCred && "token" in defaultCred) {
    return defaultCred as ApiCredentials;
  }
  return undefined;
}
