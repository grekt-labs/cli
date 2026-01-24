import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parse, stringify } from "yaml";

// Supabase project config
const SUPABASE_URL = "https://your-project.supabase.co"; // TODO: Replace with actual
const SUPABASE_ANON_KEY = "your-anon-key"; // TODO: Replace with actual

const GREKT_HOME = join(homedir(), ".grekt");
const SESSION_FILE = join(GREKT_HOME, "session.yaml");

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

/**
 * Get stored session from disk.
 */
function getStoredSession(): StoredSession | null {
  if (!existsSync(SESSION_FILE)) {
    return null;
  }
  try {
    const content = readFileSync(SESSION_FILE, "utf-8");
    return parse(content) as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Save session to disk.
 */
function saveSession(session: Session): void {
  if (!existsSync(GREKT_HOME)) {
    mkdirSync(GREKT_HOME, { recursive: true });
  }
  const stored: StoredSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
  writeFileSync(SESSION_FILE, stringify(stored), { mode: 0o600 });
}

/**
 * Clear stored session.
 */
export function clearSession(): void {
  if (existsSync(SESSION_FILE)) {
    writeFileSync(SESSION_FILE, "", { mode: 0o600 });
  }
}

/**
 * Create Supabase client with auto-refresh.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We handle persistence manually
    },
  });

  // Restore session if exists
  const stored = getStoredSession();
  if (stored) {
    _client.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
  }

  // Listen for auth changes to persist
  _client.auth.onAuthStateChange((event, session) => {
    if (session) {
      saveSession(session);
    } else if (event === "SIGNED_OUT") {
      clearSession();
    }
  });

  return _client;
}

/**
 * Get current session, refreshing if needed.
 */
export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  return session;
}

/**
 * Check if user is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
