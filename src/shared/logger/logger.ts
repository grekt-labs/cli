import type { LogLevel, Logger } from "./logger.types";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  verbose: 1,
  info: 2,
};

function resolveLogLevel(): LogLevel {
  const envValue = process.env.GREKT_LOG_LEVEL?.toLowerCase();

  if (envValue && envValue in LOG_LEVEL_PRIORITY) {
    return envValue as LogLevel;
  }

  return "info";
}

function shouldLog(messageLevel: LogLevel): boolean {
  const currentLevel = resolveLogLevel();
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) return `${arg.message}`;
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

function createPrefix(level: LogLevel): string {
  const timestamp = new Date().toISOString().slice(11, 23);
  return `\x1b[2m[${timestamp}] [${level}]\x1b[0m`;
}

export const logger: Logger = {
  debug(...args: unknown[]) {
    if (shouldLog("debug")) {
      console.error(`${createPrefix("debug")} ${formatArgs(args)}`);
    }
  },

  verbose(...args: unknown[]) {
    if (shouldLog("verbose")) {
      console.error(`${createPrefix("verbose")} ${formatArgs(args)}`);
    }
  },
};
