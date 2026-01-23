/**
 * Registry module
 *
 * Provides abstraction for multiple registry backends.
 */

export * from "./types";
export { resolveRegistry, parseArtifactId, resolveRegistryForArtifact } from "./resolver";
export { createRegistryClient } from "./factory";
