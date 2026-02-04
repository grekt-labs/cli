import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { isInitialized, getConfig, saveConfig } from "#/config/project/project";
import { getPluginChoices } from "#/sync/manager/manager";
import { cleanTargetPaths } from "#/sync/cleaner/cleaner";
import { success, error, info, newline, warn } from "#/shared/ui/ui";
import { withPromptHandler, selectTargetsToRemove } from "#/shared/prompts/prompts";

export const removeTargetCommand = new Command("remove-target")
  .description("Remove sync targets interactively")
  .action(async () => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      if (!isInitialized(projectRoot)) {
        error("grekt is not initialized in this directory");
        info("Run 'grekt init' first");
        process.exit(1);
      }

      const config = getConfig(projectRoot);

      if (config.targets.length === 0) {
        warn("No targets configured");
        info("Run 'grekt add-target' to add targets");
        return;
      }

      const pluginChoices = getPluginChoices();
      // Copy before modifying, needed for cleanTargetPaths later
      const customTargetsCopy = { ...config.customTargets };

      newline();
      const targetsToRemove = await selectTargetsToRemove(
        pluginChoices,
        config.targets,
        customTargetsCopy
      );

      if (targetsToRemove.length === 0) {
        info("No targets removed");
        return;
      }

      const targetsToRemoveSet = new Set(targetsToRemove);

      config.targets = config.targets.filter((t) => !targetsToRemoveSet.has(t));

      if (config.customTargets) {
        for (const targetId of targetsToRemove) {
          if (targetId in config.customTargets) {
            delete config.customTargets[targetId];
          }
        }

        if (Object.keys(config.customTargets).length === 0) {
          delete config.customTargets;
        }
      }

      saveConfig(config, projectRoot);

      newline();
      success(`Removed targets: ${targetsToRemove.join(", ")}`);

      // Ask if user wants to delete the target folders
      newline();
      const shouldClean = await confirm({
        message: "Delete the folders created by these targets?",
        default: false,
      });

      if (shouldClean) {
        const allDeleted: string[] = [];

        for (const targetId of targetsToRemove) {
          const result = cleanTargetPaths(projectRoot, targetId, customTargetsCopy);
          allDeleted.push(...result.deleted);
        }

        if (allDeleted.length > 0) {
          newline();
          success(`Deleted: ${allDeleted.join(", ")}`);
        } else {
          info("No folders found to delete");
        }
      }

      newline();
      if (config.targets.length > 0) {
        info(`Remaining targets: ${config.targets.join(", ")}`);
      } else {
        info("No targets remaining. Run 'grekt add-target' to add new targets");
      }
    });
  });
