import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parse, stringify } from "yaml";
import { CredentialsSchema, type Credentials, type RegistryCredentials } from "#/schemas/index";

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

export function getRegistryCredentials(registryName: string): RegistryCredentials | undefined {
  const credentials = getCredentials();
  return credentials[registryName];
}

export function setRegistryCredentials(registryName: string, creds: RegistryCredentials): void {
  const credentials = getCredentials();
  credentials[registryName] = creds;
  saveCredentials(credentials);
}

/**
 * Get credentials from env vars (fallback for CI/CD)
 */
export function getCredentialsFromEnv(): RegistryCredentials | undefined {
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
