import { Command } from "commander";
import { isInitialized } from "#/lib/config";
import { getInstalled } from "#/lib/installed";
import { error, info, log, colors, newline } from "#/utils/ui";

export const listCommand = new Command("list")
  .alias("ls")
  .description("List installed packages")
  .option("--json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const installed = getInstalled(projectRoot);
    const packages = Object.entries(installed.packages);

    if (options.json) {
      console.log(JSON.stringify(installed, null, 2));
      return;
    }

    if (packages.length === 0) {
      info("No packages installed");
      info("Run 'grekt add <package>' to install packages");
      return;
    }

    log(colors.bold("Installed packages:"));
    newline();

    for (const [name, pkg] of packages) {
      log(`  ${colors.highlight(name)}${colors.dim(`@${pkg.version}`)}`);

      if (pkg.agent) {
        log(`    ${colors.dim("agent:")} ${pkg.agent}`);
      }

      if (pkg.skills.length > 0) {
        log(`    ${colors.dim("skills:")} ${pkg.skills.join(", ")}`);
      }

      if (pkg.commands.length > 0) {
        log(`    ${colors.dim("commands:")} ${pkg.commands.join(", ")}`);
      }

      newline();
    }
  });
