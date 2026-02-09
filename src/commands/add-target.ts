import { Command } from "commander";
import { getConfig, saveConfig } from "#/config/project/project";
import { requireInitialized } from "#/shared/guards/guards";
import { getPluginChoices, getPlugin } from "#/sync/manager/manager";
import { success, error, info, newline } from "#/shared/ui/ui";
import { withPromptHandler, selectTargetsToAdd } from "#/shared/prompts/prompts";

export const addTargetCommand = new Command("add-target")
  .description("Add new sync targets interactively")
  .action(async () => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      requireInitialized(projectRoot);

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

      // Run one-time setup for each new target (e.g., create skill router)
      for (const target of newTargets) {
        const plugin = getPlugin(target, newCustomTargets);
        plugin.setup?.(projectRoot);
      }

      newline();
      success(`Added targets: ${newTargets.join(", ")}`);
      info("Run 'grekt sync' to sync artifacts to these targets");
    });
  });
