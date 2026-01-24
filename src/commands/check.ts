import { Command } from "commander";
import { isInitialized } from "#/config/project/project";
import { getLockfile } from "#/artifact/lockfile/lockfile";
import { runCheck, displayCheckResults } from "#/artifact/check/check";
import { error, info, newline } from "#/shared/ui/ui";

export const checkCommand = new Command("check")
  .description("Check artifact integrity, sync status, and detect conflicts")
  .action(async () => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const lockfile = getLockfile(projectRoot);
    const artifactIds = Object.keys(lockfile.artifacts);

    if (artifactIds.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    const summary = runCheck(projectRoot);
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
