/**
 * Registry client factory
 *
 * Single decision point for creating registry clients.
 * The factory is the ONLY place that knows about specific client implementations.
 */

import type { ResolvedRegistry, RegistryClient } from "#/registry/registry.types";
import { DefaultRegistryClient } from "#/registry/clients/default/default";
import { GitLabRegistryClient } from "#/registry/clients/gitlab/gitlab";

/**
 * Create a registry client for the resolved registry
 */
export function createRegistryClient(registry: ResolvedRegistry): RegistryClient {
  switch (registry.type) {
    case "gitlab":
      return new GitLabRegistryClient(registry);
    // case "github":
    //   return new GitHubRegistryClient(registry); // Future
    case "default":
    default:
      return new DefaultRegistryClient(registry);
  }
}
