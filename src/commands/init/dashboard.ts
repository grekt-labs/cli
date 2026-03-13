import { newline } from "#/shared/ui/ui";
import { confirmSelect } from "#/shared/prompts/prompts";
import { promptDashboardCredentials } from "#/commands/dashboard/setup";
import type { LocalConfig } from "@grekt/engine";

/**
 * Dashboard step in the init wizard.
 *
 * Asks if the user wants to use the dashboard.
 * If yes, delegates to the shared setup prompts.
 * Mutates localConfig in place.
 */
export async function promptDashboard(localConfig: LocalConfig): Promise<void> {
  newline();
  const wantsDashboard = await confirmSelect(
    "Would you like to use the grekt dashboard?",
    false,
  );

  if (!wantsDashboard) {
    return;
  }

  const credentials = await promptDashboardCredentials("Press enter to continue with grekt init...");

  if (credentials) {
    localConfig.dashboard = credentials;
  }
}
