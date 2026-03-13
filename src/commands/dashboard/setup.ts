import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
import { saveLocalConfig, getLocalConfig } from "#/config/project/project";
import { withPromptHandler, confirmSelect } from "#/shared/prompts/prompts";
import { success, info, newline } from "#/shared/ui/ui";
import type { DashboardConfig } from "@grekt/engine";

const DASHBOARD_DOCS_URL = "https://grekt.com/docs/guide/dashboard/overview";

/**
 * Prompt for dashboard URL + token.
 * Returns the config or null if the user doesn't have it running yet.
 */
export async function promptDashboardCredentials(continueMessage = "Press enter to continue..."): Promise<DashboardConfig | null> {
  const isRunning = await confirmSelect(
    "Is your dashboard already running?",
    false,
  );

  if (!isRunning) {
    newline();
    info(`Download and set it up first: ${DASHBOARD_DOCS_URL}`);
    info("You can run 'grekt dashboard setup' when it's ready.");
    newline();
    await input({ message: continueMessage });
    return null;
  }

  const url = await input({
    message: "Dashboard URL:",
    validate: (value) => {
      if (!value.trim()) return "URL is required";
      try {
        new URL(value);
        return true;
      } catch {
        return "Must be a valid URL (e.g., https://dashboard.example.com)";
      }
    },
  });

  const token = await password({
    message: "Dashboard token:",
    mask: "*",
    validate: (value) => (value.trim() ? true : "Token is required"),
  });

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

export const dashboardSetupCommand = new Command("setup")
  .description("Configure dashboard connection")
  .action(async () => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();
      const localConfig = getLocalConfig(projectRoot) ?? {};

      const credentials = await promptDashboardCredentials();

      if (credentials) {
        localConfig.dashboard = credentials;
        saveLocalConfig(localConfig, projectRoot);
        newline();
        success("Dashboard configured successfully!");
      }
    });
  });
