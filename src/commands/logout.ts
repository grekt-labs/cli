import { Command } from "commander";
import { removeRegistryToken, getRegistryToken } from "#/lib/credentials";
import { success, info } from "#/utils/ui";

export const logoutCommand = new Command("logout")
  .description("Log out from a grekt registry")
  .action(() => {
    const token = getRegistryToken();

    if (!token) {
      info("Not logged in");
      return;
    }

    // Check if using env var
    if (process.env.GREKT_TOKEN) {
      info("Using GREKT_TOKEN environment variable");
      info("Unset the environment variable to log out");
      return;
    }

    removeRegistryToken();
    success("Logged out");
  });
