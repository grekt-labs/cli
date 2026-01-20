import { Command } from "commander";
import { isInitialized } from "#/lib/config";
import { getInstalled } from "#/lib/installed";
import { error, info, log, colors, newline } from "#/utils/ui";

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

    const installed = getInstalled(projectRoot);
    const artifacts = Object.entries(installed.artifacts);

    if (options.json) {
      console.log(JSON.stringify(installed, null, 2));
      return;
    }

    if (artifacts.length === 0) {
      info("No artifacts installed");
      info("Run 'grekt add <artifact>' to install artifacts");
      return;
    }

    log(colors.bold("Installed artifacts:"));
    newline();

    for (const [name, artifact] of artifacts) {
      log(`  ${colors.highlight(name)}${colors.dim(`@${artifact.version}`)}`);

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
  });
