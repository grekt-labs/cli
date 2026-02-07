export type LogLevel = "debug" | "verbose" | "info";

export interface Logger {
  debug: (...args: unknown[]) => void;
  verbose: (...args: unknown[]) => void;
}
