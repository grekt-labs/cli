import { Command } from "commander";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile } from "#/context";
import { runCheck, runSyncCheck } from "#/artifact/check/check";
import { displayCheckResults, displaySyncCheckResults } from "#/artifact/check/display";
import { info, newline } from "#/shared/ui/ui";

export const checkCommand = new Command("check")
  .description("Check artifact integrity, sync status, and detect conflicts")
  .action(async () => {
    const projectRoot = process.cwd();

    requireInitialized(projectRoot);

    const lockfile = getLockfile(projectRoot);
    const artifactIds = Object.keys(lockfile.artifacts);

    if (artifactIds.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    const summary = runCheck(projectRoot, lockfile);
    displayCheckResults(summary, lockfile);

    const syncSummary = runSyncCheck(projectRoot, lockfile);
    displaySyncCheckResults(syncSummary);

    const hasIssues = !summary.healthy || !syncSummary.healthy;

    if (hasIssues) {
      newline();

      if (summary.driftCount > 0) {
        info("To restore modified artifacts: grekt install --force");
      }
      if (summary.missingCount > 0) {
        info("To reinstall missing artifacts: grekt install");
      }
      if (!syncSummary.healthy) {
        info("To restore synced files: grekt sync --force");
      }
    }
  });
