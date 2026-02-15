import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import {
  getGlobalSession,
  saveGlobalSession,
  clearGlobalSession,
} from "#/config/user/user";
import type { StoredSession } from "@grekt-labs/cli-engine";
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_ANON_KEY as DEFAULT_ANON_KEY,
} from "#/constants";

// Supabase project config - defaults to official grekt registry
// Env vars allow override for development or self-hosted registries
export function getSupabaseUrl(): string {
  return process.env.GREKT_SUPABASE_URL || SUPABASE_PROJECT_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.GREKT_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
}

/**
 * Check if Supabase is configured.
 * Returns false if environment variables are not set.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

// Deprecated: project root is no longer used for session storage
// Session is now stored globally in ~/.grekt/session.yaml
let _projectRoot: string = process.cwd();

/**
 * @deprecated Session is now stored globally. This function is kept for backwards compatibility.
 */
export function setProjectRoot(projectRoot: string): void {
  _projectRoot = projectRoot;
}

/**
 * @deprecated Session is now stored globally. This function is kept for backwards compatibility.
 */
export function getProjectRoot(): string {
  return _projectRoot;
}

/**
 * In-memory storage adapter for Supabase auth.
 * We handle session persistence manually (to ~/.grekt/session.yaml),
 * but Supabase needs a working storage to keep the PKCE code verifier
 * between signInWithOAuth and exchangeCodeForSession.
 */
const memoryStorage: Record<string, string> = {};

const inMemoryStorageAdapter = {
  getItem: (key: string): string | null => memoryStorage[key] ?? null,
  setItem: (key: string, value: string): void => { memoryStorage[key] = value; },
  removeItem: (key: string): void => { delete memoryStorage[key]; },
};

/**
 * Create Supabase client with auto-refresh.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase not configured. Set GREKT_SUPABASE_URL and GREKT_SUPABASE_ANON_KEY environment variables."
    );
  }

  _client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      flowType: "pkce",
      storage: inMemoryStorageAdapter,
    },
  });

  // Restore session from global config
  const stored = getGlobalSession();
  if (stored) {
    _client.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
  }

  // Listen for auth changes to persist to global config
  _client.auth.onAuthStateChange((event, session) => {
    if (session) {
      const toStore: StoredSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      };
      saveGlobalSession(toStore);
    } else if (event === "SIGNED_OUT") {
      clearGlobalSession();
    }
  });

  return _client;
}

/**
 * Reset the client (for testing or when switching projects).
 */
export function resetClient(): void {
  _client = null;
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

/**
 * Clear session from global config.
 */
export function clearSession(): void {
  clearGlobalSession();
}
