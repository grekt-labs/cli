import { Command } from "commander";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getPluginChoices } from "#/sync/manager/manager";
import { success, error, info, newline } from "#/shared/ui/ui";
import { withPromptHandler, selectTargets } from "#/shared/prompts/prompts";

export const addTargetCommand = new Command("add-target")
  .description("Add or configure sync targets interactively")
  .action(async () => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      if (!isInitialized(projectRoot)) {
        error("grekt is not initialized in this directory");
        info("Run 'grekt init' first");
        process.exit(1);
      }

      const config = getConfig(projectRoot);
      const pluginChoices = getPluginChoices();

      newline();
      const { targets, customTargets } = await selectTargets(pluginChoices, {
        currentTargets: config.targets,
        currentCustomTargets: config.customTargets,
      });

      config.targets = targets;
      config.customTargets = customTargets;
      saveConfig(config, projectRoot);

      if (targets.length === 0) {
        info("No targets selected");
        return;
      }

      newline();
      success(`Targets configured: ${targets.join(", ")}`);
      info("Run 'grekt sync' to sync artifacts to these targets");
    });
  });
