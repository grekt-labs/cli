import { join } from "path";
import { REGISTRY_URL, LOCKFILE } from "#/constants";

// Project-level paths (relative to project root)
export const GREKT_YAML = "grekt.yaml"; // project config: sync targets and artifact declarations
export { LOCKFILE }; // re-export from constants (canonical source)

// Hidden directory for artifacts (gitignored, stores downloaded artifacts)
export const GREKT_DIR = ".grekt";
export const ARTIFACTS_DIR = join(GREKT_DIR, "artifacts");
export const INDEX_FILE = join(GREKT_DIR, "index");

// Reports directory (for dashboard sync consumption)
export const REPORTS_DIR = join(GREKT_DIR, "reports");
export const SCAN_REPORT_FILE = "scan.json";
export const EVAL_REPORT_FILE = "eval.json";

// Default registry
export const DEFAULT_REGISTRY = REGISTRY_URL;
