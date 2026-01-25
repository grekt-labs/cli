/**
 * Registry client factory
 *
 * Single decision point for creating registry clients.
 * Injects dependencies from CLI context.
 */

import {
  type ResolvedRegistry,
  type RegistryClient,
  type LocalConfig,
  type TokenProvider,
  resolveRegistry as _resolveRegistry,
  createRegistryClient as _createRegistryClient,
} from "@grekt-labs/cli-engine";
import { fs, http, shell, createTokenProvider } from "#/context";

/**
 * Resolve a scope to a registry configuration (with dependencies injected)
 */
export function resolveRegistry(
  scope: string,
  localConfig: LocalConfig | null,
  projectRoot: string = process.cwd()
): ResolvedRegistry {
  const tokens = createTokenProvider(projectRoot);
  return _resolveRegistry(scope, localConfig, tokens);
}

/**
 * Create a registry client for the resolved registry (with dependencies injected)
 */
export function createRegistryClient(registry: ResolvedRegistry): RegistryClient {
  return _createRegistryClient(registry, http, fs, shell);
}
