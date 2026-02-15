import { Command } from "commander";
import { select, input, password } from "@inquirer/prompts";
import { browserLogin, emailLogin, type OAuthProvider } from "#/auth/oauth/oauth";
import { setProjectRoot } from "#/auth/session/session";
import { requireInitialized } from "#/shared/guards/guards";
import { withPromptHandler } from "#/shared/prompts/prompts";
import { success, error, info, log, spinner } from "#/shared/ui/ui";

async function interactiveEmailFlow(): Promise<void> {
  const emailAddress = await input({
    message: "Email:",
    validate: (value) => (value.trim() ? true : "Email is required"),
  });

  const userPassword = await password({
    message: "Password:",
    validate: (value) => (value.trim() ? true : "Password is required"),
  });

  const spin = spinner("Logging in...");
  spin.start();

  try {
    await emailLogin(emailAddress, userPassword);
    spin.stop();
    success("Logged in");
  } catch (err) {
    spin.stop();
    error(err instanceof Error ? err.message : "Login failed");
    process.exit(1);
  }
}

async function interactiveBrowserFlow(provider: OAuthProvider): Promise<void> {
  const spin = spinner("Waiting for authentication...");

  try {
    await browserLogin(provider, {
      onAuthUrl: (url) => {
        log("");
        info("Opening browser for authentication...");
        log("");
        log(`  If the browser doesn't open, visit:`);
        log(`  ${url}`);
        log("");
        spin.start();
      },
    });
    spin.stop();
    success("Logged in");
  } catch (err) {
    spin.stop();
    error(err instanceof Error ? err.message : "Login failed");
    process.exit(1);
  }
}

async function nonInteractiveEmailFlow(email: string, userPassword: string): Promise<void> {
  const spin = spinner("Logging in...");
  spin.start();

  try {
    await emailLogin(email, userPassword);
    spin.stop();
    success("Logged in");
  } catch (err) {
    spin.stop();
    error(err instanceof Error ? err.message : "Login failed");
    process.exit(1);
  }
}

export const loginCommand = new Command("login")
  .description("Log in to grekt registry")
  .option("--email <email>", "Email for non-interactive login")
  .option("--password <password>", "Password for non-interactive login")
  .action(async (options: { email?: string; password?: string }) => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    setProjectRoot(projectRoot);

    if (options.email && options.password) {
      await nonInteractiveEmailFlow(options.email, options.password);
      return;
    }

    if (options.email || options.password) {
      error("Both --email and --password are required for non-interactive login");
      process.exit(1);
    }

    await withPromptHandler(async () => {
      const method = await select({
        message: "Login method:",
        choices: [
          { name: "GitHub (browser)", value: "github" as const },
          { name: "Google (browser)", value: "google" as const },
          { name: "Email & password", value: "email" as const },
        ],
      });

      if (method === "email") {
        await interactiveEmailFlow();
      } else {
        await interactiveBrowserFlow(method);
      }
    });
  });
