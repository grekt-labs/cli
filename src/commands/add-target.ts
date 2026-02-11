import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { getConfig, saveConfig } from "#/config/project/project";
import { getLockfile } from "#/context";
import { requireInitialized } from "#/shared/guards/guards";
import { getPluginChoices, getPlugin } from "#/sync/manager/manager";
import { runSync } from "#/sync/helpers/helpers";
import { success, info, newline } from "#/shared/ui/ui";
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

      const lockfile = getLockfile(projectRoot);
      const hasPreviousArtifacts = Object.keys(lockfile.artifacts).length > 0;

      if (!hasPreviousArtifacts) {
        info("Run 'grekt add <artifact>' to install artifacts, then 'grekt sync'");
        return;
      }

      newline();
      const shouldSync = await confirm({
        message: "Run sync now to generate files for the new targets?",
        default: true,
      });

      if (shouldSync) {
        await runSync({
          targets: newTargets,
          lockfile,
          projectRoot,
          projectConfig: config,
          customTargets: config.customTargets,
          createTarget: true,
        });

        newline();
        success("Sync complete!");
      } else {
        info("Run 'grekt sync' when you're ready to generate files");
      }
    });
  });
