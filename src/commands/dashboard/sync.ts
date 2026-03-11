import { Command } from "commander";
import { getLocalConfig } from "#/config/project/project";
import { syncToDashboard } from "#/dashboard/dashboard";
import { success, info, newline } from "#/shared/ui/ui";

const SYNC_TARGETS = ["registries"] as const;
type SyncTarget = (typeof SYNC_TARGETS)[number];

async function handleSyncRegistries(): Promise<void> {
  const localConfig = getLocalConfig();
  const registries = localConfig?.registries;

  if (!registries || Object.keys(registries).length === 0) {
    info("No registries configured. Nothing to sync.");
    return;
  }

  const scopeCount = Object.keys(registries).length;

  await syncToDashboard(async (reporter) => {
    await reporter.reportRegistries(registries);
  });

  newline();
  success(`Synced ${scopeCount} ${scopeCount === 1 ? "registry" : "registries"} to dashboard.`);
}

const syncHandlers: Record<SyncTarget, () => Promise<void>> = {
  registries: handleSyncRegistries,
};

export const dashboardSyncCommand = new Command("sync")
  .description("Sync local data to the dashboard")
  .argument("<target>", `What to sync (${SYNC_TARGETS.join(", ")})`)
  .action(async (target: string) => {
    if (!SYNC_TARGETS.includes(target as SyncTarget)) {
      throw new Error(`Unknown sync target: "${target}". Available targets: ${SYNC_TARGETS.join(", ")}`);
    }

    await syncHandlers[target as SyncTarget]();
  });
