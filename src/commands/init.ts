import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { checkbox } from "@inquirer/prompts";
import { isInitialized, saveConfig } from "#/lib/config";
import { saveLockfile, createEmptyLockfile } from "#/lib/lockfile";
import { getPluginChoices, getDefaultTarget } from "#/lib/plugins";
import { GREKT_YAML, GREKT_DIR, ARTIFACTS_DIR } from "#/lib/paths";
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

    // Create .grekt/artifacts/ directory
    const artifactsPath = `${projectRoot}/${ARTIFACTS_DIR}`;
    if (!existsSync(artifactsPath)) {
      mkdirSync(artifactsPath, { recursive: true });
    }

    // Create grekt.yaml
    saveConfig({
      targets,
      autoSync: false,
      artifacts: {},
    }, projectRoot);

    // Create grekt.lock
    const lockfile = createEmptyLockfile();
    saveLockfile(lockfile, projectRoot);

    newline();
    success(`Created ${GREKT_YAML}`);
    success(`Created ${GREKT_DIR}/`);
    success("Created grekt.lock");
    newline();
    success("grekt initialized successfully!");
    newline();
    info(`Sync targets: ${targets.join(", ")}`);
    info("Run 'grekt add <artifact>' to install your first artifact");
  });
