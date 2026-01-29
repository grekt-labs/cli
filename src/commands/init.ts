import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { basename } from "path";
import { checkbox, input, confirm } from "@inquirer/prompts";
import { isInitialized, saveConfig } from "#/config/project/project";
import { saveLockfile, createEmptyLockfile } from "#/context";
import { getPluginChoices, getDefaultTarget } from "#/sync/manager/manager";
import { createEmptyIndex } from "#/artifact/index/index";
import { GREKT_YAML, GREKT_DIR, ARTIFACTS_DIR, INDEX_FILE } from "#/config/paths/paths";
import { success, info, warning, newline, log, colors } from "#/shared/ui/ui";
import type { CustomTarget, ProjectConfig } from "@grekt-labs/cli-engine";

const OTHER_TARGET_VALUE = "__other__";

export const initCommand = new Command("init")
  .description("Initialize grekt in the current directory")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option("-a, --artifact", "Initialize as publishable artifact (includes manifest fields)")
  .action(async (options: { yes?: boolean; artifact?: boolean }) => {
    const projectRoot = process.cwd();

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

      const author = await input({
        message: "Author (e.g., @username):",
        validate: (value) => {
          if (!value.trim()) return "Author is required";
          if (!value.startsWith("@")) return "Author must start with @";
          return true;
        },
      });

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
    const customTargets: Record<string, CustomTarget> = {};

    // For artifacts, ask if they want to configure targets (optional)
    // For projects, always ask for targets
    const shouldConfigureTargets = options.artifact
      ? !options.yes && await confirm({ message: "Configure sync targets? (optional for artifacts)", default: false })
      : true;

    if (shouldConfigureTargets && !options.yes) {
      const choices = [
        ...pluginChoices.map((choice, index) => ({
          ...choice,
          checked: !options.artifact && index === 0, // First plugin checked by default for projects
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

      if (targets.length === 0 && !options.artifact) {
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
      ...manifestFields,
      targets,
      autoSync: false,
      artifacts: {},
      customTargets,
      options: { autoCheck: false },
    }, projectRoot);

    // Create grekt.lock
    const lockfile = createEmptyLockfile();
    saveLockfile(lockfile, projectRoot);

    // Create empty index
    createEmptyIndex(projectRoot);

    newline();
    success(`Created ${GREKT_YAML}`);
    success(`Created ${GREKT_DIR}/`);
    success("Created grekt.lock");
    success(`Created ${INDEX_FILE}`);
    newline();

    if (options.artifact) {
      success("Artifact initialized successfully!");
      newline();
      info(`Artifact: ${manifestFields.author}/${manifestFields.name}@${manifestFields.version}`);
      info("Run 'grekt publish' when ready to publish");
    } else {
      success("grekt initialized successfully!");
      newline();
      info(`Sync targets: ${targets.join(", ")}`);
      info("Run 'grekt add <artifact>' to install your first artifact");
    }
  });
