import { Command } from "commander";
import { requireInitialized } from "#/shared/guards/guards";
import { getLockfile } from "#/context";
import { runCheck } from "#/artifact/check/check";
import { displayCheckResults } from "#/artifact/check/display";
import { error, info, newline } from "#/shared/ui/ui";

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

    if (!summary.healthy) {
      newline();

      if (summary.driftCount > 0) {
        info("To restore modified artifacts: grekt install --force");
      }
      if (summary.missingCount > 0) {
        info("To reinstall missing artifacts: grekt install");
      }
    }
  });
