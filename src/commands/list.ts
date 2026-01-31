import { Command } from "commander";
import { existsSync } from "fs";
import { isInitialized } from "#/config/project/project";
import { getLockfile, getDirectorySize } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { formatBytes, estimateTokens } from "@grekt-labs/cli-engine";
import { error, info, log, colors, newline } from "#/shared/ui/ui";
import { CATEGORIES } from "@grekt-labs/cli-engine";

export const listCommand = new Command("list")
  .alias("ls")
  .description("List installed artifacts")
  .option("--json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const lockfile = getLockfile(projectRoot);
    const artifacts = Object.entries(lockfile.artifacts);

    if (options.json) {
      console.log(JSON.stringify(lockfile, null, 2));
      return;
    }

    if (artifacts.length === 0) {
      info("No artifacts installed");
      info("Run 'grekt add <artifact>' to install artifacts");
      return;
    }

    log(colors.bold("Installed artifacts:"));
    newline();

    let totalSize = 0;

    for (const [name, artifact] of artifacts) {
      const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${name}`;
      let size = 0;
      let sizeStr = "";

      if (existsSync(artifactDir)) {
        size = getDirectorySize(artifactDir);
        totalSize += size;
        sizeStr = formatBytes(size);
      }

      log(`  ${colors.highlight(name)}${colors.dim(`@${artifact.version}`)}  ${colors.dim(sizeStr)}`);

      for (const category of CATEGORIES) {
        const paths = artifact[category];
        if (paths && paths.length > 0) {
          log(`    ${colors.dim(`${category}:`)} ${paths.join(", ")}`);
        }
      }

      newline();
    }

    // Show total context size
    log(colors.dim("─".repeat(40)));
    log(`  Total: ${formatBytes(totalSize)} (~${estimateTokens(totalSize).toLocaleString()} tokens)`);

  });
