import { Command } from "commander";
import {
  getConfig,
  setConfigValue,
  isInitialized,
} from "#/config/project/project";
import { success, error, info, log, colors } from "#/shared/ui/ui";
import type { ProjectConfig } from "@grekt-labs/cli-engine";

const VALID_KEYS: (keyof ProjectConfig)[] = ["targets", "autoSync", "registry"];

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

    const config = getConfig();
    log(colors.bold("Configuration (grekt.yaml):"));
    for (const [key, value] of Object.entries(config)) {
      if (key !== "artifacts") {
        log(`  ${colors.highlight(key)}: ${formatValue(value)}`);
      }
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
    setConfigValue(key as keyof ProjectConfig, parsed);
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

    const config = getConfig();

    if (key in config) {
      log(formatValue(config[key as keyof ProjectConfig]));
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
