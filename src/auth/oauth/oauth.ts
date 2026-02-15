import { getSupabaseClient, getSupabaseUrl } from "#/auth/session/session";
import { saveGlobalSession } from "#/config/user/user";
import { shell } from "#/context";
import type { StoredSession } from "@grekt-labs/cli-engine";
import { randomUUID } from "crypto";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = 2_000; // 2 seconds

export type OAuthProvider = "github" | "google";

/**
 * Open a URL in the default browser.
 * Supports macOS, Windows, and Linux.
 * Uses execFile with array args to prevent URL injection.
 */
export function openBrowser(url: string): boolean {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      shell.execFile("open", [url]);
    } else if (platform === "win32") {
      // Use rundll32 to avoid cmd shell interpretation of special chars like &
      // This directly invokes the URL protocol handler without shell parsing
      shell.execFile("rundll32", ["url.dll,FileProtocolHandler", url]);
    } else {
      shell.execFile("xdg-open", [url]);
    }
    return true;
  } catch {
    // If browser fails to open, user will need to copy the URL manually
    return false;
  }
}

export interface BrowserLoginCallbacks {
  onAuthUrl?: (url: string) => void;
}

interface PollResponse {
  status: "pending" | "ready" | "error";
  code?: string;
  error?: string;
}

/**
 * Poll the cli-auth-poll endpoint until it returns a code or times out.
 */
async function pollForAuthCode(sessionId: string): Promise<string> {
  const supabaseUrl = getSupabaseUrl();
  const pollUrl = `${supabaseUrl}/functions/v1/cli-auth-poll?session_id=${sessionId}`;
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(pollUrl);

    if (!response.ok) {
      // Transient errors: wait and retry
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const data = (await response.json()) as PollResponse;

    if (data.status === "ready" && data.code) {
      return data.code;
    }

    if (data.status === "error") {
      throw new Error(data.error || "Authentication failed");
    }

    // Still pending
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Login timed out. Please try again.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * OAuth login flow using hosted callback + polling.
 * Works in WSL2, remote SSH, and containers where localhost is unreachable.
 *
 * Flow:
 * 1. Generate a random session ID
 * 2. Build redirect URL pointing to cli-auth-callback edge function
 * 3. Open browser with Supabase OAuth URL (PKCE enabled)
 * 4. Poll cli-auth-poll until auth code arrives
 * 5. Exchange code for session using PKCE verifier
 * 6. Explicitly save session to disk
 */
export async function browserLogin(
  provider: OAuthProvider,
  callbacks?: BrowserLoginCallbacks,
): Promise<void> {
  const supabase = getSupabaseClient();
  const supabaseUrl = getSupabaseUrl();

  const sessionId = randomUUID();
  const redirectTo = `${supabaseUrl}/functions/v1/cli-auth-callback?session_id=${sessionId}`;

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError || !data.url) {
    throw oauthError || new Error("Failed to generate auth URL");
  }

  callbacks?.onAuthUrl?.(data.url);
  openBrowser(data.url);

  const code = await pollForAuthCode(sessionId);

  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    throw exchangeError;
  }

  // Explicitly save session instead of relying on async onAuthStateChange
  if (sessionData.session) {
    const toStore: StoredSession = {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
    };
    saveGlobalSession(toStore);
  }
}

/**
 * Email/password login (non-interactive, for CI/CD).
 */
export async function emailLogin(
  email: string,
  password: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw signInError;
  }

  // Explicitly save session instead of relying on async onAuthStateChange
  if (data.session) {
    const toStore: StoredSession = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
    saveGlobalSession(toStore);
  }
}
