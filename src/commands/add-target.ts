import { Command } from "commander";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getPluginChoices } from "#/sync/manager/manager";
import { success, error, info, newline, warn } from "#/shared/ui/ui";
import { withPromptHandler, selectTargetsToAdd } from "#/shared/prompts/prompts";

export const addTargetCommand = new Command("add-target")
  .description("Add new sync targets interactively")
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
      const { newTargets, newCustomTargets } = await selectTargetsToAdd(
        pluginChoices,
        config.targets,
        config.customTargets ?? {}
      );

      if (newTargets.length === 0) {
        info("No new targets added");
        return;
      }

      config.targets = [...config.targets, ...newTargets];
      config.customTargets = {
        ...config.customTargets,
        ...newCustomTargets,
      };
      saveConfig(config, projectRoot);

      newline();
      success(`Added targets: ${newTargets.join(", ")}`);
      info("Run 'grekt sync' to sync artifacts to these targets");
    });
  });
