import chalk from "chalk";
import ora, { type Ora } from "ora";

// Colors
export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  dim: chalk.dim,
  bold: chalk.bold,
  highlight: chalk.cyan,
  brand: chalk.hex("#10ab8d"),
};

// Symbols
export const symbols = {
  success: chalk.green("✓"),
  error: chalk.red("✗"),
  warning: chalk.yellow("⚠"),
  info: chalk.blue("i"),
  arrow: chalk.dim("→"),
  bullet: chalk.dim("•"),
};

// Logging helpers
export function success(message: string): void {
  console.log(`${symbols.success} ${message}`);
}

export function error(message: string): void {
  console.error(`${symbols.error} ${colors.error(message)}`);
}

export function warning(message: string): void {
  console.log(`${symbols.warning} ${colors.warning(message)}`);
}

export function info(message: string): void {
  console.log(`${symbols.info} ${message}`);
}

export function log(message: string): void {
  console.log(message);
}

export function newline(): void {
  console.log();
}

// Spinner
export function spinner(text: string): Ora {
  return ora({ text, color: "cyan" });
}
