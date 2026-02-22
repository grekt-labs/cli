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
import { fs, http, shell, tarOps, createTokenProvider } from "#/context";
import { getToken } from "#/config/project/project";
import { getGlobalSession } from "#/config/user/user";

/**
 * Resolve a scope to a registry configuration (with dependencies injected).
 *
 * Supports GREKT_REGISTRY_URL env var to override the default registry endpoint.
 * Useful for local development or self-hosted registries.
 * Example: GREKT_REGISTRY_URL=http://localhost:54321/functions/v1
 */
export function resolveRegistry(
  scope: string,
  localConfig: LocalConfig | null,
  projectRoot: string = process.cwd()
): ResolvedRegistry {
  const getSessionToken = () => getGlobalSession()?.access_token;
  const tokens = createTokenProvider(projectRoot, getToken, getSessionToken);
  const resolved = _resolveRegistry(scope, localConfig, tokens);

  if (resolved.type === "default" && process.env.GREKT_REGISTRY_URL) {
    const override = process.env.GREKT_REGISTRY_URL.replace(/\/$/, "");
    resolved.apiBasePath = override;
    resolved.host = "";
  }

  return resolved;
}

/**
 * Create a registry client for the resolved registry (with dependencies injected)
 */
export function createRegistryClient(registry: ResolvedRegistry): RegistryClient {
  return _createRegistryClient(registry, http, fs, shell, tarOps);
}
