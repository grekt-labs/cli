import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { checkbox } from "@inquirer/prompts";
import { isInitialized, setProjectConfig } from "../lib/config.js";
import { saveInstalled, createEmptyInstalled } from "../lib/installed.js";
import { saveLockfile, createEmptyLockfile } from "../lib/lockfile.js";
import {
  PROJECT_CONFIG_DIR,
  GREKTS_DIR,
  AGENTS_DIR,
  SKILLS_DIR,
  COMMANDS_DIR,
} from "../lib/paths.js";
import { success, error, info, warning, newline } from "../utils/ui.js";
import type { SyncTarget } from "../schemas/index.js";

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

    // Select targets
    let targets: SyncTarget[] = ["claude"];

    if (!options.yes) {
      targets = await checkbox<SyncTarget>({
        message: "Select AI tools to sync with:",
        choices: [
          { name: "Claude", value: "claude", checked: true },
          { name: "Cursor", value: "cursor" },
          { name: "Windsurf", value: "windsurf" },
        ],
      });

      if (targets.length === 0) {
        targets = ["claude"];
        info("No targets selected, defaulting to Claude");
      }
    }

    // Create directories
    const dirs = [
      PROJECT_CONFIG_DIR,
      GREKTS_DIR,
      AGENTS_DIR,
      SKILLS_DIR,
      COMMANDS_DIR,
    ];

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
