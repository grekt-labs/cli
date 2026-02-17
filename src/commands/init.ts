import { Command } from "commander";
import { basename } from "path";
import { fs } from "#/context";
import { input, confirm } from "@inquirer/prompts";
import { isInitialized, saveConfig } from "#/config/project/project";
import { getPluginChoices, getDefaultTarget, getPlugin } from "#/sync/manager/manager";
import { createEmptyIndex } from "#/artifact/index/index";
import { GREKT_YAML, GREKT_DIR, ARTIFACTS_DIR, INDEX_FILE } from "#/config/paths/paths";
import { ensureGitignore } from "#/shared/gitignore/gitignore";
import { success, info, warning, newline, log, colors } from "#/shared/ui/ui";
import { withPromptHandler, selectTargets } from "#/shared/prompts/prompts";
import { ASCII_LOGO } from "#/constants";
import type { CustomTarget, ProjectConfig } from "@grekt-labs/cli-engine";

export const initCommand = new Command("init")
  .description("Initialize grekt in the current directory")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("-a, --artifact", "Initialize as publishable artifact (includes manifest fields)")
  .action(async (options: { yes?: boolean; artifact?: boolean }) => {
    await withPromptHandler(async () => {
      const projectRoot = process.cwd();

      // Show logo
      log(colors.brand(ASCII_LOGO));

      // Check if already initialized
      if (isInitialized(projectRoot)) {
        warning("grekt is already initialized in this directory");
        return;
      }

      info("Initializing grekt...");
      newline();

    // Manifest fields (for --artifact mode)
    let manifestFields: Partial<ProjectConfig> = {};

    if (options.artifact) {
      log(colors.bold("Artifact manifest:"));
      newline();

      const defaultName = basename(projectRoot);

      const name = await input({
        message: "Artifact name:",
        default: defaultName,
        validate: (value) => {
          if (!value.trim()) return "Name is required";
          if (!/^[a-z0-9-]+$/.test(value)) return "Name must be lowercase alphanumeric with dashes";
          return true;
        },
      });

      const authorInput = await input({
        message: "Author (e.g., grekt):",
        validate: (value) => (value.trim() ? true : "Author is required"),
      });
      const author = authorInput.startsWith("@") ? authorInput.slice(1) : authorInput;

      const version = await input({
        message: "Version:",
        default: "1.0.0",
        validate: (value) => {
          if (!value.trim()) return "Version is required";
          if (!/^\d+\.\d+\.\d+/.test(value)) return "Version must be semver (e.g., 1.0.0)";
          return true;
        },
      });

      const description = await input({
        message: "Description:",
        validate: (value) => (value.trim() ? true : "Description is required"),
      });

      const keywordsStr = await input({
        message: "Keywords (comma-separated, 3-5 recommended):",
        validate: (value) => {
          const keywords = value.split(",").map((k) => k.trim()).filter(Boolean);
          if (keywords.length === 0) return "At least one keyword is required";
          return true;
        },
      });

      const keywords = keywordsStr.split(",").map((k) => k.trim()).filter(Boolean);

      manifestFields = { name, author, version, description, keywords };
      newline();
    }

    // Get available plugins
    const pluginChoices = getPluginChoices();
    const defaultTarget = getDefaultTarget();

    // Select targets
    let targets: string[] = options.artifact ? [] : [defaultTarget];
    let customTargets: Record<string, CustomTarget> = {};

    // For artifacts, ask if they want to configure targets (optional)
    // For projects, always ask for targets
    const shouldConfigureTargets = options.artifact
      ? !options.yes && await confirm({ message: "Configure sync targets? (optional for artifacts)", default: false })
      : true;

    if (shouldConfigureTargets && !options.yes) {
      const result = await selectTargets(pluginChoices, {
        defaultCheckedIndex: options.artifact ? undefined : 0,
      });

      targets = result.targets;
      customTargets = result.customTargets;

      if (targets.length === 0 && !options.artifact) {
        targets = [defaultTarget];
        info(`No targets selected, defaulting to ${pluginChoices[0]?.name ?? defaultTarget}`);
      }
    }

    // Ask about remote search (skip for artifacts and --yes)
    let remoteSearch = true;
    if (!options.artifact && !options.yes) {
      newline();
      info("When no installed skill matches, grekt can search the public registry for one that does.");
      remoteSearch = await confirm({
        message: "Allow remote skill search?",
        default: true,
      });
    }

    // Create .grekt/artifacts/ directory
    const artifactsPath = `${projectRoot}/${ARTIFACTS_DIR}`;
    if (!fs.exists(artifactsPath)) {
      fs.mkdir(artifactsPath, { recursive: true });
    }

    // Create grekt.yaml
    saveConfig({
      ...manifestFields,
      targets,
      remoteSearch,
      artifacts: {},
      customTargets,
    }, projectRoot);

    // Create empty index
    createEmptyIndex(projectRoot);

    ensureGitignore(projectRoot);

    // Run one-time setup for each selected target (e.g., create skill router)
    for (const target of targets) {
      const plugin = getPlugin(target, customTargets);
      plugin.setup?.(projectRoot);
    }

    newline();
    success(`Created ${GREKT_YAML}`);
    success(`Created ${GREKT_DIR}/`);
    success(`Created ${INDEX_FILE}`);
    newline();

    if (options.artifact) {
      success("Artifact initialized successfully!");
      newline();
      info(`Artifact: @${manifestFields.author}/${manifestFields.name}@${manifestFields.version}`);
      info("Run 'grekt publish' when ready to publish");
    } else {
      success("grekt initialized successfully!");
      newline();
      info(`Sync targets: ${targets.join(", ")}`);
      info("Run 'grekt add <artifact>' to install your first artifact");
    }
    });
  });
