import { Command } from "commander";
import { getRegistryToken, getRegistryUrl } from "#/lib/credentials";
import { createRegistryClient } from "#/lib/registry-client";
import { log, colors, spinner } from "#/utils/ui";

export const whoamiCommand = new Command("whoami")
  .description("Show current user")
  .action(async () => {
    const token = getRegistryToken();
    const registryUrl = getRegistryUrl();

    if (!token) {
      log("Not logged in");
      log(colors.dim(`Registry: ${registryUrl}`));
      return; // Exit 0, informational
    }

    const spin = spinner("Checking...");
    spin.start();

    const client = createRegistryClient();

    try {
      const user = await client.whoami();
      spin.stop();

      if (user) {
        log(`Logged in as ${colors.highlight(user.email)}`);
        log(colors.dim(`Registry: ${registryUrl}`));
      } else {
        log("Not logged in");
        log(colors.dim(`Registry: ${registryUrl}`));
      }
    } catch {
      spin.stop();
      // Token invalid/expired = not logged in
      log("Not logged in");
      log(colors.dim(`Registry: ${registryUrl}`));
    }
    // Always exit 0
  });
