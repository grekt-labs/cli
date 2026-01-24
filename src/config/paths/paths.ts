import { join } from "path";

// Project-level paths (relative to project root)
export const GREKT_YAML = "grekt.yaml"; // project config: sync targets and artifact declarations
export const LOCKFILE = "grekt.lock"; // pinned versions, integrity hashes, resolved URLs

// Hidden directory for artifacts (gitignored, stores downloaded artifacts)
export const GREKT_DIR = ".grekt";
export const ARTIFACTS_DIR = join(GREKT_DIR, "artifacts");

// Default registry
export const DEFAULT_REGISTRY = "https://registry.grekt.com";
