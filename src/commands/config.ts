import { Command } from "commander";
import {
  getGlobalConfig,
  setGlobalConfigValue,
  getProjectConfig,
  isInitialized,
  ensureGlobalConfigDir,
} from "#/lib/config.js";
import { success, error, info, log, colors, newline } from "#/utils/ui.js";
import type { GlobalConfig } from "#/schemas/index.js";

const VALID_KEYS: (keyof GlobalConfig)[] = [
  "registry",
  "telemetry",
  "defaultTargets",
  "autoSync",
];

export const configCommand = new Command("config")
  .description("Manage grekt configuration");

configCommand
  .command("list")
  .description("Show current configuration")
  .option("-g, --global", "Show only global config")
  .option("-l, --local", "Show only local project config")
  .action((options: { global?: boolean; local?: boolean }) => {
    if (!options.local) {
      ensureGlobalConfigDir();
      const globalConfig = getGlobalConfig();
      log(colors.bold("Global config (~/.grekt/config.yaml):"));
      for (const [key, value] of Object.entries(globalConfig)) {
        log(`  ${colors.highlight(key)}: ${formatValue(value)}`);
      }
    }

    if (!options.global) {
      newline();
      if (isInitialized()) {
        const projectConfig = getProjectConfig();
        log(colors.bold("Project config (.grekt/config.yaml):"));
        for (const [key, value] of Object.entries(projectConfig)) {
          log(`  ${colors.highlight(key)}: ${formatValue(value)}`);
        }
      } else {
        info("No project config (grekt not initialized in this directory)");
      }
    }
  });

configCommand
  .command("set <key> <value>")
  .description("Set a global configuration value")
  .action((key: string, value: string) => {
    ensureGlobalConfigDir();

    if (!VALID_KEYS.includes(key as keyof GlobalConfig)) {
      error(`Invalid key: ${key}`);
      info(`Valid keys: ${VALID_KEYS.join(", ")}`);
      process.exit(1);
    }

    const parsed = parseValue(key, value);
    setGlobalConfigValue(key as keyof GlobalConfig, parsed);
    success(`Set ${key} = ${formatValue(parsed)}`);
  });

configCommand
  .command("get <key>")
  .description("Get a configuration value")
  .action((key: string) => {
    ensureGlobalConfigDir();
    const globalConfig = getGlobalConfig();

    if (key in globalConfig) {
      log(formatValue(globalConfig[key as keyof GlobalConfig]));
    } else {
      error(`Unknown key: ${key}`);
      process.exit(1);
    }
  });

function parseValue(key: string, value: string): unknown {
  // Boolean values
  if (key === "telemetry" || key === "autoSync") {
    return value === "true" || value === "1";
  }

  // Array values (comma-separated)
  if (key === "defaultTargets") {
    return value.split(",").map((s) => s.trim());
  }

  // String values
  return value;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return colors.dim(`[${value.join(", ")}]`);
  }
  if (typeof value === "boolean") {
    return value ? colors.success("true") : colors.dim("false");
  }
  return colors.dim(String(value));
}
