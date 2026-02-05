/**
 * Registry resolver
 *
 * Normalizes config to ResolvedRegistry.
 * Parse once, never parse again - downstream code only sees ResolvedRegistry.
 */

import type { LocalConfig, ResolvedRegistry, RegistryType } from "#/registry/registry.types";

import { ARTIFACT_ID_REGEX, REGISTRY_HOST } from "#/constants";

const DEFAULT_REGISTRY_HOST = REGISTRY_HOST;

/**
 * Parse artifact ID into scope and name
 *
 * Supports both formats:
 * - @scope/name (standard)
 * - scope/name (@ is optional, will be normalized)
 *
 * @example
 * parseArtifactId("@miscope/agent-tools") → { scope: "@miscope", name: "agent-tools", artifactId: "@miscope/agent-tools" }
 * parseArtifactId("grekt/tools") → { scope: "@grekt", name: "tools", artifactId: "@grekt/tools" }
 * parseArtifactId("@scope/name@1.0.0") → { scope: "@scope", name: "name", version: "1.0.0", artifactId: "@scope/name" }
 */
export function parseArtifactId(source: string): {
  scope: string;
  name: string;
  version?: string;
  artifactId: string;
} {
  // Match @?scope/name optionally followed by @version (@ is optional in input)
  const match = source.match(ARTIFACT_ID_REGEX);

  if (!match) {
    throw new Error(`Invalid artifact ID: ${source}. Expected format: @scope/name or scope/name`);
  }

  // Regex captures scope without @, so we always add it for normalization
  const [, scopeWithoutAt, name, version] = match;
  const scope = `@${scopeWithoutAt}`;
  const artifactId = `${scope}/${name}`;

  return {
    scope,
    name: name!,
    version,
    artifactId,
  };
}

/**
 * Get default host for a registry type
 */
function getDefaultHost(type: RegistryType): string {
  switch (type) {
    case "gitlab":
      return "gitlab.com";
    case "github":
      return "github.com";
    case "default":
    default:
      return DEFAULT_REGISTRY_HOST;
  }
}

/**
 * Resolve a scope to a registry configuration
 *
 * Priority:
 * 1. Explicit config in .grekt/config.yaml
 * 2. Fall back to default public registry
 *
 * Token priority:
 * 1. Config file token (.grekt/config.yaml)
 * 2. Platform env vars (GITLAB_TOKEN, GITHUB_TOKEN)
 */
export function resolveRegistry(
  scope: string,
  localConfig: LocalConfig | null
): ResolvedRegistry {
  const entry = localConfig?.registries?.[scope];

  if (!entry) {
    // No config for scope → use public registry
    return {
      type: "default",
      host: DEFAULT_REGISTRY_HOST,
    };
  }

  // Get token from config, fall back to platform env vars
  let token = entry.token;

  if (!token) {
    if (entry.type === "gitlab") {
      token = process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
    } else if (entry.type === "github") {
      token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    }
  }

  return {
    type: entry.type,
    host: entry.host || getDefaultHost(entry.type),
    project: entry.project,
    token,
    folder: entry.folder,
  };
}

/**
 * Resolve registry for an artifact ID
 *
 * Convenience function that parses the artifact ID and resolves the registry.
 */
export function resolveRegistryForArtifact(
  artifactSource: string,
  localConfig: LocalConfig | null
): { registry: ResolvedRegistry; artifactId: string; version?: string } {
  const { scope, artifactId, version } = parseArtifactId(artifactSource);
  const registry = resolveRegistry(scope, localConfig);

  return { registry, artifactId, version };
}
