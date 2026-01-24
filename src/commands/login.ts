import { Command } from "commander";
import { createServer, type Server } from "http";
import { getSupabaseClient, SUPABASE_URL } from "#/auth/session/session";
import { success, error, info, log, spinner } from "#/shared/ui/ui";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  try {
    const { execSync } = require("child_process");
    execSync(command, { stdio: "ignore" });
  } catch {
    // If browser fails to open, user will need to copy the URL manually
  }
}

/**
 * OAuth login flow with Supabase Auth
 * Uses Supabase's hosted auth UI - providers are configured in Supabase dashboard
 */
async function browserLogin(): Promise<void> {
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
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Login Failed</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>Login Failed</h1>
              <p>${errorDescription || errorParam}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
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
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Login Successful</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Login Successful</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          cleanup();
          resolve();
        } catch (err) {
          res.statusCode = 400;
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Login Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Login Failed</h1>
                <p>${err instanceof Error ? err.message : "Failed to exchange code"}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(err);
        }
        return;
      }

      // No code or error - invalid request
      res.statusCode = 400;
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Invalid Request</title></head>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Invalid Request</h1>
            <p>No authorization code received.</p>
          </body>
        </html>
      `);
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
      // This opens Supabase's hosted auth page with all configured providers
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github", // Default provider, can be configured
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We handle browser opening ourselves
        },
      });

      if (oauthError || !data.url) {
        cleanup();
        reject(oauthError || new Error("Failed to generate auth URL"));
        return;
      }

      log("");
      info("Opening browser for authentication...");
      log("");
      log(`  If the browser doesn't open, visit:`);
      log(`  ${data.url}`);
      log("");

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
 * Email/password login (non-interactive, for CI/CD)
 */
async function emailLogin(email: string, password: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw signInError;
  }
}

export const loginCommand = new Command("login")
  .description("Log in to grekt registry")
  .option("--email <email>", "Email for non-interactive login")
  .option("--password <password>", "Password for non-interactive login")
  .action(async (options: { email?: string; password?: string }) => {
    // Non-interactive mode: email/password
    if (options.email && options.password) {
      const spin = spinner("Logging in...");
      spin.start();

      try {
        await emailLogin(options.email, options.password);
        spin.stop();
        success("Logged in");
      } catch (err) {
        spin.stop();
        error(err instanceof Error ? err.message : "Login failed");
        process.exit(1);
      }
      return;
    }

    if (options.email || options.password) {
      error("Both --email and --password are required for non-interactive login");
      process.exit(1);
    }

    // Interactive mode: browser OAuth flow
    const spin = spinner("Waiting for authentication...");

    try {
      await browserLogin();
      spin.start();
      spin.stop();
      success("Logged in");
    } catch (err) {
      spin.stop();
      error(err instanceof Error ? err.message : "Login failed");
      process.exit(1);
    }
  });
