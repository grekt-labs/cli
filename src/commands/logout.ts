import { Command } from "commander";
import { getSupabaseClient, clearSession } from "#/auth/session/session";
import { success, info } from "#/shared/ui/ui";

export const logoutCommand = new Command("logout")
  .description("Log out from grekt registry")
  .action(async () => {
    const supabase = getSupabaseClient();

    // Sign out from Supabase (invalidates session)
    await supabase.auth.signOut();

    // Clear local session file
    clearSession();

    success("Logged out");
  });
