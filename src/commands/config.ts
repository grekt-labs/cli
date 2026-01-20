import { Command } from "commander";
import {
  getProjectConfig,
  setProjectConfigValue,
  isInitialized,
} from "#/lib/config";
import { success, error, info, log, colors } from "#/utils/ui";
import type { ProjectConfig } from "#/schemas/index";

const VALID_KEYS: (keyof ProjectConfig)[] = ["targets", "autoSync"];

export const configCommand = new Command("config")
  .description("Manage project configuration");

configCommand
  .command("list")
  .description("Show current configuration")
  .action(() => {
    if (!isInitialized()) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const projectConfig = getProjectConfig();
    log(colors.bold("Configuration (.grekt/config.yaml):"));
    for (const [key, value] of Object.entries(projectConfig)) {
      log(`  ${colors.highlight(key)}: ${formatValue(value)}`);
    }
  });

configCommand
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action((key: string, value: string) => {
    if (!isInitialized()) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    if (!VALID_KEYS.includes(key as keyof ProjectConfig)) {
      error(`Invalid key: ${key}`);
      info(`Valid keys: ${VALID_KEYS.join(", ")}`);
      process.exit(1);
    }

    const parsed = parseValue(key, value);
    setProjectConfigValue(key as keyof ProjectConfig, parsed);
    success(`Set ${key} = ${formatValue(parsed)}`);
  });

configCommand
  .command("get <key>")
  .description("Get a configuration value")
  .action((key: string) => {
    if (!isInitialized()) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const projectConfig = getProjectConfig();

    if (key in projectConfig) {
      log(formatValue(projectConfig[key as keyof ProjectConfig]));
    } else {
      error(`Unknown key: ${key}`);
      process.exit(1);
    }
  });

function parseValue(key: string, value: string): unknown {
  // Boolean values
  if (key === "autoSync") {
    return value === "true" || value === "1";
  }

  // Array values (comma-separated)
  if (key === "targets") {
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
