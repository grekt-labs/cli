import { Command } from "commander";
import { getSupabaseClient, getSession, SUPABASE_URL } from "#/lib/supabase";
import { log, colors, spinner } from "#/utils/ui";

export const whoamiCommand = new Command("whoami")
  .description("Show current user")
  .action(async () => {
    const spin = spinner("Checking...");
    spin.start();

    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      spin.stop();

      if (error || !user) {
        log("Not logged in");
        log(colors.dim(`Registry: ${SUPABASE_URL}`));
        return; // Exit 0, informational
      }

      log(`Logged in as ${colors.highlight(user.email || user.id)}`);
      log(colors.dim(`Registry: ${SUPABASE_URL}`));
    } catch {
      spin.stop();
      // Token invalid/expired = not logged in
      log("Not logged in");
      log(colors.dim(`Registry: ${SUPABASE_URL}`));
    }
    // Always exit 0
  });
