import { homedir } from "os";
import { join } from "path";

// Global directory (~/.grekt/) - for credentials only
export const GLOBAL_CONFIG_DIR = join(homedir(), ".grekt");
export const GLOBAL_CREDENTIALS_FILE = join(GLOBAL_CONFIG_DIR, "credentials.yaml");

// Project-level paths (relative to project root)
export const GREKT_YAML = "grekt.yaml"; // config + artifact declarations (like package.json)
export const LOCKFILE = "grekt.lock"; // exact versions + integrity (like package-lock.json)

// Hidden directory for artifacts (gitignored, like node_modules)
export const GREKT_DIR = ".grekt";
export const ARTIFACTS_DIR = join(GREKT_DIR, "artifacts");

// Default registry
export const DEFAULT_REGISTRY = "https://registry.grekt.com";
