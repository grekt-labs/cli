import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { checkbox } from "@inquirer/prompts";
import { isInitialized, setProjectConfig } from "#/lib/config";
import { saveInstalled, createEmptyInstalled } from "#/lib/installed";
import { saveLockfile, createEmptyLockfile } from "#/lib/lockfile";
import { getPluginChoices, getDefaultTarget } from "#/lib/plugins";
import { PROJECT_CONFIG_DIR, GREKTS_DIR } from "#/lib/paths";
import { success, info, warning, newline } from "#/utils/ui";

export const initCommand = new Command("init")
  .description("Initialize grekt in the current directory")
  .option("-y, --yes", "Skip prompts and use defaults")
  .action(async (options: { yes?: boolean }) => {
    const projectRoot = process.cwd();

    // Check if already initialized
    if (isInitialized(projectRoot)) {
      warning("grekt is already initialized in this directory");
      return;
    }

    info("Initializing grekt...");
    newline();

    // Get available plugins
    const pluginChoices = getPluginChoices();
    const defaultTarget = getDefaultTarget();

    // Select targets
    let targets: string[] = [defaultTarget];

    if (!options.yes) {
      const choices = pluginChoices.map((choice, index) => ({
        ...choice,
        checked: index === 0, // First plugin checked by default
      }));

      targets = await checkbox<string>({
        message: "Select AI tools to sync with:",
        choices,
      });

      if (targets.length === 0) {
        targets = [defaultTarget];
        info(`No targets selected, defaulting to ${pluginChoices[0]?.name ?? defaultTarget}`);
      }
    }

    // Create directories
    const dirs = [PROJECT_CONFIG_DIR, GREKTS_DIR];

    for (const dir of dirs) {
      const fullPath = `${projectRoot}/${dir}`;
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    }

    // Create project config
    setProjectConfig({ targets }, projectRoot);

    // Create installed.yaml
    const installed = createEmptyInstalled();
    saveInstalled(installed, projectRoot);

    // Create grekt.lock
    const lockfile = createEmptyLockfile();
    saveLockfile(lockfile, projectRoot);

    newline();
    success(`Created ${PROJECT_CONFIG_DIR}/`);
    success(`Created ${GREKTS_DIR}/`);
    success(`Created ${GREKTS_DIR}/installed.yaml`);
    success("Created grekt.lock");
    newline();
    success("grekt initialized successfully!");
    newline();
    info(`Sync targets: ${targets.join(", ")}`);
    info("Run 'grekt add <artifact>' to install your first artifact");
  });
