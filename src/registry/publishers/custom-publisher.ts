import { logger } from "#/shared/logger/logger";
import { createRegistryClient } from "#/registry/factory/factory";
import type { ResolvedRegistry } from "#/registry/registry.types";
import type { Publisher, PublishContext, PublishResult } from "./publisher.types";

/**
 * Publisher for custom registries (GitLab, GitHub, etc.).
 */
export class CustomPublisher implements Publisher {
  readonly type: string;
  private registry: ResolvedRegistry;

  constructor(registry: ResolvedRegistry) {
    this.type = registry.type;
    this.registry = registry;
  }

  async versionExists(ctx: PublishContext): Promise<boolean> {
    const client = createRegistryClient(this.registry);
    try {
      return await client.versionExists(ctx.artifactId, ctx.version);
    } catch (err) {
      logger.debug("CustomPublisher.versionExists failed:", ctx.artifactId, ctx.version, err);
      return false;
    }
  }

  async getLatestVersion(ctx: PublishContext): Promise<string | null> {
    const client = createRegistryClient(this.registry);
    try {
      return await client.getLatestVersion(ctx.artifactId);
    } catch (err) {
      logger.debug("CustomPublisher.getLatestVersion failed:", ctx.artifactId, err);
      return null;
    }
  }

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const client = createRegistryClient(this.registry);

    try {
      const result = await client.publish({
        artifactId: ctx.artifactId,
        version: ctx.version,
        tarballPath: ctx.tarballPath,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Unknown error",
        };
      }

      return {
        success: true,
        url: result.url,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * Get the registry configuration for error messages.
   */
  getRegistry(): ResolvedRegistry {
    return this.registry;
  }
}
