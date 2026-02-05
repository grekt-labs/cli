import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import {
  getSession as getStoredSession,
  saveSession as saveStoredSession,
  clearSession as clearStoredSession,
} from "#/config/project/project";
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

// Current project root for session persistence
let _projectRoot: string = process.cwd();

/**
 * Set the project root for session operations.
 * Call this before any auth operations.
 */
export function setProjectRoot(projectRoot: string): void {
  _projectRoot = projectRoot;
}

/**
 * Get the current project root.
 */
export function getProjectRoot(): string {
  return _projectRoot;
}

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
      persistSession: false, // We handle persistence manually
    },
  });

  // Restore session from project config if exists
  const stored = getStoredSession(_projectRoot);
  if (stored) {
    _client.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
  }

  // Listen for auth changes to persist to project config
  _client.auth.onAuthStateChange((event, session) => {
    if (session) {
      const toStore: StoredSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      };
      saveStoredSession(toStore, _projectRoot);
    } else if (event === "SIGNED_OUT") {
      clearStoredSession(_projectRoot);
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
 * Clear session from project config.
 */
export function clearSession(): void {
  clearStoredSession(_projectRoot);
}
