import { Command } from "commander";
import { getSupabaseClient, setProjectRoot, getSupabaseUrl } from "#/auth/session/session";
import { requireInitialized } from "#/shared/guards/guards";
import { log, colors, spinner, error as showError } from "#/shared/ui/ui";

export const whoamiCommand = new Command("whoami")
  .description("Show current user")
  .action(async () => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    // Set project root for session operations
    setProjectRoot(projectRoot);

    const spin = spinner("Checking...");
    spin.start();

    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      spin.stop();

      if (error || !user) {
        log("Not logged in");
        log(colors.dim(`Registry: ${getSupabaseUrl()}`));
        return; // Exit 0, informational
      }

      log(`Logged in as ${colors.highlight(user.email || user.id)}`);
      log(colors.dim(`Registry: ${getSupabaseUrl()}`));
    } catch {
      spin.stop();
      // Token invalid/expired = not logged in
      log("Not logged in");
      log(colors.dim(`Registry: ${getSupabaseUrl()}`));
    }
    // Always exit 0
  });
