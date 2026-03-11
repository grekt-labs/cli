import { Command } from "commander";
import { dashboardSyncCommand } from "./sync";

export const dashboardCommand = new Command("dashboard")
  .description("Manage dashboard integration")
  .addCommand(dashboardSyncCommand);
