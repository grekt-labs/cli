import { Command } from "commander";
import { existsSync } from "fs";
import { isInitialized } from "#/lib/config";
import { getLockfile } from "#/lib/lockfile";
import { ARTIFACTS_DIR } from "#/lib/paths";
import { getDirectorySize, formatBytes, estimateTokens } from "#/lib/integrity";
import { error, info, log, warning, colors, newline, symbols } from "#/utils/ui";

const CONTEXT_WARNING_THRESHOLD = 10 * 1024; // 10 KB

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

      // Show size warning indicator
      const sizeIndicator = size > 5 * 1024 ? ` ${symbols.warning}` : "";

      log(`  ${colors.highlight(name)}${colors.dim(`@${artifact.version}`)}  ${colors.dim(sizeStr)}${sizeIndicator}`);

      if (artifact.agent) {
        log(`    ${colors.dim("agent:")} ${artifact.agent}`);
      }

      if (artifact.skills.length > 0) {
        log(`    ${colors.dim("skills:")} ${artifact.skills.join(", ")}`);
      }

      if (artifact.commands.length > 0) {
        log(`    ${colors.dim("commands:")} ${artifact.commands.join(", ")}`);
      }

      newline();
    }

    // Show total context size
    log(colors.dim("─".repeat(40)));
    log(`  Total: ${formatBytes(totalSize)} (~${estimateTokens(totalSize).toLocaleString()} tokens)`);

    if (totalSize > CONTEXT_WARNING_THRESHOLD) {
      newline();
      warning("Total context exceeds 10 KB. Consider:");
      log("  • Removing unused artifacts");
      log("  • Using smaller/more focused artifacts");
    }
  });
