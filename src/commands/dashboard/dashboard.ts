import { Command } from "commander";
import { dashboardSyncCommand } from "./sync";
import { dashboardSetupCommand } from "./setup";

export const dashboardCommand = new Command("dashboard")
  .description("Manage dashboard integration")
  .addCommand(dashboardSetupCommand)
  .addCommand(dashboardSyncCommand);
