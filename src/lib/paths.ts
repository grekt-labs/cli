import { homedir } from "os";
import { join } from "path";

// Global directory (~/.grekt/) - for credentials only
export const GLOBAL_CONFIG_DIR = join(homedir(), ".grekt");
export const GLOBAL_CREDENTIALS_FILE = join(GLOBAL_CONFIG_DIR, "credentials.yaml");

// Project-level paths (relative to project root)
export const GREKT_YAML = "grekt.yaml"; // project config: sync targets and artifact declarations
export const LOCKFILE = "grekt.lock"; // pinned versions, integrity hashes, resolved URLs

// Hidden directory for artifacts (gitignored, stores downloaded artifacts)
export const GREKT_DIR = ".grekt";
export const ARTIFACTS_DIR = join(GREKT_DIR, "artifacts");

// Default registry
export const DEFAULT_REGISTRY = "https://registry.grekt.com";
