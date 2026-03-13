import { Command } from "commander";
import { isInitialized, getLocalConfig } from "#/config/project/project";
import { info, warning, newline, log, colors } from "#/shared/ui/ui";
import { withPromptHandler, confirmSelect } from "#/shared/prompts/prompts";
import { ASCII_LOGO } from "#/constants";
import { promptManifestFields } from "./manifest";
import { resolveTargets } from "./targets";
import { promptRegistries } from "./registries";
import { promptDashboard } from "./dashboard";
import { createProjectFiles } from "./files";
import { showSummary } from "./summary";
import type { InitOptions, InitState } from "./init.types";

export const initCommand = new Command("init")
  .description("Initialize grekt in the current directory")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("-a, --artifact", "Initialize as publishable artifact (includes manifest fields)")
  .option("--targets <targets>", "Comma-separated list of targets to configure (skips target prompt)")
  .action(async (options: InitOptions) => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      // Step 1: Logo + welcome
      log(colors.brand(ASCII_LOGO));

      if (isInitialized(projectRoot)) {
        warning("grekt is already initialized in this directory");
        return;
      }

      info("Initializing grekt...");
      newline();

      // Accumulate state through each wizard step
      const state: InitState = {
        projectRoot,
        manifestFields: {},
        detectedTargets: [],
        targets: [],
        customTargets: {},
        remoteSearch: true,
        localConfig: getLocalConfig(projectRoot) ?? {},
        scopesMissingTokens: [],
      };

      // Step 2-3: Manifest (artifact mode only)
      if (options.artifact) {
        state.manifestFields = await promptManifestFields(projectRoot);
      }

      // Step 2-3: Auto-detect + target selection
      const targetResult = await resolveTargets(projectRoot, options);
      state.detectedTargets = targetResult.detectedTargets;
      state.targets = targetResult.targets;
      state.customTargets = targetResult.customTargets;

      // Step 4: Remote search
      if (!options.artifact && !options.yes) {
        newline();
        info("grekt includes a skill that improves artifact discovery in your project.");
        info("It can also search the public registry when no local match is found.");
        state.remoteSearch = await confirmSelect(
          "Allow public registry search?",
          true,
        );
      }

      // Step 5: Self-hosted registries
      if (!options.artifact && !options.yes) {
        const registryResult = await promptRegistries(state.localConfig);
        state.localConfig = registryResult.localConfig;
        state.scopesMissingTokens = registryResult.scopesMissingTokens;
      }

      // Step 6: Dashboard setup
      if (!options.artifact && !options.yes) {
        await promptDashboard(state.localConfig);
      }

      // Step 7-8: Create files + plugin setup
      const { hasLocalConfig } = createProjectFiles(state);

      // Step 9: Summary + next steps
      await showSummary(state, {
        hasLocalConfig,
        isArtifact: !!options.artifact,
        skipPrompts: !!options.yes,
      });
    });
  });
