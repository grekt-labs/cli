import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { checkbox, input } from "@inquirer/prompts";
import { isInitialized, saveConfig } from "#/config/project/project";
import { saveLockfile, createEmptyLockfile } from "#/context";
import { getPluginChoices, getDefaultTarget } from "#/sync/manager/manager";
import { GREKT_YAML, GREKT_DIR, ARTIFACTS_DIR } from "#/config/paths/paths";
import { success, info, warning, newline, log, colors } from "#/shared/ui/ui";
import type { CustomTarget } from "@grekt-labs/cli-engine";

const OTHER_TARGET_VALUE = "__other__";

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
    const customTargets: Record<string, CustomTarget> = {};

    if (!options.yes) {
      const choices = [
        ...pluginChoices.map((choice, index) => ({
          ...choice,
          checked: index === 0, // First plugin checked by default
        })),
        {
          name: "Other (custom)",
          value: OTHER_TARGET_VALUE,
          checked: false,
        },
      ];

      const selected = await checkbox<string>({
        message: "Select AI tools to sync with:",
        choices,
      });

      // Handle "Other" selection
      if (selected.includes(OTHER_TARGET_VALUE)) {
        newline();
        log(colors.bold("Configure custom target:"));
        newline();

        const customId = await input({
          message: "Target ID (e.g., my-ai):",
          validate: (value) => {
            if (!value.trim()) return "ID is required";
            if (!/^[a-z0-9-]+$/.test(value)) return "ID must be lowercase alphanumeric with dashes";
            if (pluginChoices.some((p) => p.value === value)) return "ID conflicts with built-in target";
            return true;
          },
        });

        const customName = await input({
          message: "Display name (e.g., My AI Tool):",
          validate: (value) => (value.trim() ? true : "Name is required"),
        });

        const rulesFile = await input({
          message: "Rules file path (e.g., .my-ai-rules.md):",
          validate: (value) => (value.trim() ? true : "Rules file path is required"),
        });

        customTargets[customId] = {
          name: customName,
          rulesFile,
        };

        // Replace __other__ with the custom ID
        targets = selected.filter((t) => t !== OTHER_TARGET_VALUE);
        targets.push(customId);
      } else {
        targets = selected;
      }

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
      customTargets,
      options: { autoCheck: false },
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
