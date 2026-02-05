import { dirname, join } from "path";
import { homedir } from "os";
import { parse, stringify } from "yaml";
import { fs } from "#/context";
import type { StoredSession } from "@grekt-labs/cli-engine";

// Global user config directory
const USER_CONFIG_DIR = join(homedir(), ".grekt");
const SESSION_FILE = "session.yaml";

function getSessionPath(): string {
  return join(USER_CONFIG_DIR, SESSION_FILE);
}

function ensureDir(filepath: string): void {
  const dir = dirname(filepath);
  if (!fs.exists(dir)) {
    fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Get the stored session from ~/.grekt/session.yaml
 */
export function getGlobalSession(): StoredSession | null {
  const filepath = getSessionPath();
  if (!fs.exists(filepath)) {
    return null;
  }

  try {
    const content = fs.readFile(filepath);
    const data = parse(content) as StoredSession;
    if (!data?.access_token || !data?.refresh_token) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Save session to ~/.grekt/session.yaml
 */
export function saveGlobalSession(session: StoredSession): void {
  const filepath = getSessionPath();
  ensureDir(filepath);

  const content = stringify(session);
  fs.writeFile(filepath, content);
  fs.chmod(filepath, 0o600);
}

/**
 * Clear session from ~/.grekt/session.yaml
 */
export function clearGlobalSession(): void {
  const filepath = getSessionPath();
  if (fs.exists(filepath)) {
    fs.unlink(filepath);
  }
}

/**
 * Get the path to the global session file (for display purposes)
 */
export function getGlobalSessionPath(): string {
  return getSessionPath();
}
