import { Command } from "commander";
import { browserLogin, emailLogin } from "#/auth/oauth/oauth";
import { setProjectRoot } from "#/auth/session/session";
import { isInitialized } from "#/config/project/project";
import { success, error, info, log, spinner } from "#/shared/ui/ui";

export const loginCommand = new Command("login")
  .description("Log in to grekt registry")
  .option("--email <email>", "Email for non-interactive login")
  .option("--password <password>", "Password for non-interactive login")
  .action(async (options: { email?: string; password?: string }) => {
    const projectRoot = process.cwd();

    // Require project initialization
    if (!isInitialized(projectRoot)) {
      error("Not in a grekt project. Run 'grekt init' first.");
      process.exit(1);
    }

    // Set project root for session persistence
    setProjectRoot(projectRoot);

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
      await browserLogin({
        onAuthUrl: (url) => {
          log("");
          info("Opening browser for authentication...");
          log("");
          log(`  If the browser doesn't open, visit:`);
          log(`  ${url}`);
          log("");
        },
      });
      spin.start();
      spin.stop();
      success("Logged in");
    } catch (err) {
      spin.stop();
      error(err instanceof Error ? err.message : "Login failed");
      process.exit(1);
    }
  });
