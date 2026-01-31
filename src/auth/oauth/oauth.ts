import { createServer, type Server } from "http";
import { execFileSync } from "child_process";
import { getSupabaseClient } from "#/auth/session/session";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Open a URL in the default browser.
 * Supports macOS, Windows, and Linux.
 * Uses execFileSync with array args to prevent URL injection.
 */
export function openBrowser(url: string): boolean {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      execFileSync("open", [url], { stdio: "ignore" });
    } else if (platform === "win32") {
      // Use rundll32 to avoid cmd shell interpretation of special chars like &
      // This directly invokes the URL protocol handler without shell parsing
      execFileSync("rundll32", ["url.dll,FileProtocolHandler", url], { stdio: "ignore" });
    } else {
      execFileSync("xdg-open", [url], { stdio: "ignore" });
    }
    return true;
  } catch {
    // If browser fails to open, user will need to copy the URL manually
    return false;
  }
}

/**
 * HTML template for success page.
 */
function successHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Login Successful</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Login Successful</h1>
        <p>You can close this window and return to the terminal.</p>
      </body>
    </html>
  `;
}

/**
 * HTML template for error page.
 */
function errorHtml(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Login Failed</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Login Failed</h1>
        <p>${message}</p>
        <p>You can close this window.</p>
      </body>
    </html>
  `;
}

/**
 * HTML template for invalid request page.
 */
function invalidRequestHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Invalid Request</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Invalid Request</h1>
        <p>No authorization code received.</p>
      </body>
    </html>
  `;
}

export interface BrowserLoginResult {
  success: boolean;
  authUrl?: string;
}

export interface BrowserLoginCallbacks {
  onAuthUrl?: (url: string) => void;
}

/**
 * OAuth login flow with Supabase Auth.
 * Starts a local HTTP server to receive the OAuth callback.
 */
export async function browserLogin(callbacks?: BrowserLoginCallbacks): Promise<void> {
  const supabase = getSupabaseClient();

  return new Promise((resolve, reject) => {
    let server: Server;
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeoutId);
      server?.close();
    };

    server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost`);
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      res.setHeader("Content-Type", "text/html");

      if (errorParam) {
        res.statusCode = 400;
        res.end(errorHtml(errorDescription || errorParam));
        cleanup();
        reject(new Error(errorDescription || errorParam));
        return;
      }

      if (code) {
        try {
          // Exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          res.statusCode = 200;
          res.end(successHtml());
          cleanup();
          resolve();
        } catch (err) {
          res.statusCode = 400;
          res.end(errorHtml(err instanceof Error ? err.message : "Failed to exchange code"));
          cleanup();
          reject(err);
        }
        return;
      }

      // No code or error - invalid request
      res.statusCode = 400;
      res.end(invalidRequestHtml());
    });

    // Bind explicitly to 127.0.0.1, never 0.0.0.0
    server.listen(0, "127.0.0.1", async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        cleanup();
        reject(new Error("Failed to start local server"));
        return;
      }

      const port = address.port;
      const redirectUrl = `http://localhost:${port}/callback`;

      // Use Supabase SDK to generate auth URL with PKCE
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) {
        cleanup();
        reject(oauthError || new Error("Failed to generate auth URL"));
        return;
      }

      // Notify caller of auth URL
      callbacks?.onAuthUrl?.(data.url);

      // Try to open browser
      openBrowser(data.url);
    });

    // Timeout after 5 minutes
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Login timed out. Please try again."));
    }, LOGIN_TIMEOUT_MS);

    server.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Email/password login (non-interactive, for CI/CD).
 */
export async function emailLogin(email: string, password: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw signInError;
  }
}
