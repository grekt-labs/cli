import { getLocalConfig } from "#/config/project/project";
import { resolveRegistry } from "#/registry/resolver/resolver";
import type { Publisher } from "./publisher.types";
import { ApiPublisher } from "./api-publisher";
import { CustomPublisher } from "./custom-publisher";
import { S3Publisher } from "./s3-publisher";

export interface PublisherOptions {
  /**
   * Force S3 legacy mode.
   */
  s3?: boolean;
  /**
   * Scope of the artifact (@author).
   */
  scope: string;
  /**
   * Project root for config lookup.
   */
  projectRoot: string;
}

/**
 * Create the appropriate publisher based on options and configuration.
 *
 * Priority:
 * 1. --s3 flag → S3Publisher (legacy, env vars only)
 * 2. Custom registry config → CustomPublisher
 * 3. Default → ApiPublisher
 */
export function createPublisher(options: PublisherOptions): Publisher {
  // S3 legacy mode takes priority
  if (options.s3) {
    return new S3Publisher();
  }

  // Check for custom registry configuration
  const localConfig = getLocalConfig(options.projectRoot);
  const registry = resolveRegistry(options.scope, localConfig);

  if (registry.type !== "default") {
    // Use custom registry (GitLab, GitHub, etc.)
    return new CustomPublisher(registry);
  }

  // Use default API-based registry
  return new ApiPublisher();
}

/**
 * Get publisher type name for display.
 */
export function getPublisherTypeName(publisher: Publisher): string {
  switch (publisher.type) {
    case "api":
      return "grekt registry";
    case "s3":
      return "S3 storage";
    case "gitlab":
      return "GitLab registry";
    case "github":
      return "GitHub registry";
    default:
      return `${publisher.type} registry`;
  }
}
