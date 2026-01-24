import { Command } from "commander";
import { getSupabaseClient, clearSession, setProjectRoot } from "#/auth/session/session";
import { isInitialized } from "#/config/project/project";
import { success, error } from "#/shared/ui/ui";

export const logoutCommand = new Command("logout")
  .description("Log out from grekt registry")
  .action(async () => {
    const projectRoot = process.cwd();

    // Require project initialization
    if (!isInitialized(projectRoot)) {
      error("Not in a grekt project. Run 'grekt init' first.");
      process.exit(1);
    }

    // Set project root for session operations
    setProjectRoot(projectRoot);

    const supabase = getSupabaseClient();

    // Sign out from Supabase (invalidates session)
    await supabase.auth.signOut();

    // Clear local session from project config
    clearSession();

    success("Logged out");
  });
