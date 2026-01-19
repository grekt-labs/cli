import { homedir } from "os";
import { join } from "path";

// Global config directory (~/.grekt/)
export const GLOBAL_CONFIG_DIR = join(homedir(), ".grekt");
export const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, "config.yaml");
export const GLOBAL_CREDENTIALS_FILE = join(GLOBAL_CONFIG_DIR, "credentials.yaml");

// Project-level paths (relative to project root)
export const PROJECT_CONFIG_DIR = ".grekt";
export const PROJECT_CONFIG_FILE = join(PROJECT_CONFIG_DIR, "config.yaml");
export const LOCKFILE = "grekt.lock";

// Grekts directory (where packages are stored as grekts/@scope/name/)
export const GREKTS_DIR = "grekts";
export const INSTALLED_FILE = join(GREKTS_DIR, "installed.yaml");

// Default registry
export const DEFAULT_REGISTRY = "https://registry.grekt.com";
