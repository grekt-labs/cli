import { Command } from "commander";
import { createServer, type Server } from "http";
import { setRegistryToken } from "#/lib/credentials";
import { DEFAULT_REGISTRY } from "#/lib/paths";
import { success, error, info, log, spinner } from "#/utils/ui";

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
 * OAuth login flow - one-shot ephemeral server
 */
async function oauthLogin(registryUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let server: Server;
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeoutId);
      server?.close();
    };

    server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost`);
      const token = url.searchParams.get("token");
      const errorParam = url.searchParams.get("error");

      // Set CORS headers
      res.setHeader("Content-Type", "text/html");

      if (errorParam) {
        res.statusCode = 400;
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Login Failed</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>Login Failed</h1>
              <p>${errorParam}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        cleanup();
        reject(new Error(errorParam));
        return;
      }

      if (token) {
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
        resolve(token);
        return;
      }

      // No token or error - invalid request
      res.statusCode = 400;
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Invalid Request</title></head>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Invalid Request</h1>
            <p>No token received.</p>
          </body>
        </html>
      `);
    });

    // Bind explicitly to 127.0.0.1, never 0.0.0.0
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        cleanup();
        reject(new Error("Failed to start local server"));
        return;
      }

      const port = address.port;
      const callbackUrl = `http://localhost:${port}/callback`;
      const authUrl = `${registryUrl}/auth/cli?redirect=${encodeURIComponent(callbackUrl)}`;

      log("");
      info("Opening browser for authentication...");
      log("");
      log(`  If the browser doesn't open, visit:`);
      log(`  ${authUrl}`);
      log("");

      openBrowser(authUrl);
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

export const loginCommand = new Command("login")
  .description("Log in to a grekt registry")
  .option("-r, --registry <url>", "Registry URL", DEFAULT_REGISTRY)
  .option("--token <token>", "Use token directly (for CI/CD)")
  .action(async (options: { registry: string; token?: string }) => {
    // CI/CD mode: validate and save token directly
    if (options.token) {
      setRegistryToken(options.token, options.registry);
      success("Logged in");
      return;
    }

    // OAuth mode: one-shot ephemeral flow
    const spin = spinner("Waiting for authentication...");

    try {
      const token = await oauthLogin(options.registry);
      spin.start();
      spin.stop();
      setRegistryToken(token, options.registry);
      success("Logged in");
    } catch (err) {
      spin.stop();
      error(err instanceof Error ? err.message : "Login failed");
      process.exit(1);
    }
  });
