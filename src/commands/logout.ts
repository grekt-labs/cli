import { Command } from "commander";
import { getSupabaseClient, clearSession, setProjectRoot } from "#/auth/session/session";
import { requireInitialized } from "#/shared/guards/guards";
import { success, error } from "#/shared/ui/ui";

export const logoutCommand = new Command("logout")
  .description("Log out from grekt registry")
  .action(async () => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    // Set project root for session operations
    setProjectRoot(projectRoot);

    const supabase = getSupabaseClient();

    // Sign out from Supabase (invalidates session)
    await supabase.auth.signOut();

    // Clear local session from project config
    clearSession();

    success("Logged out");
  });
