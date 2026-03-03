import { logger } from "#/shared/logger/logger";
import { isAuthenticated, isSupabaseConfigured } from "#/auth/session/session";
import { fs, http } from "#/context";
import { resolveRegistry, createRegistryClient } from "#/registry/factory/factory";
import { getLocalConfig } from "#/config/project/project";
import { RegistryApiError, type DefaultRegistryOperations, type RegistryClient } from "@grekt/engine";
import type { Publisher, PublishContext, PublishResult } from "./publisher.types";

/**
 * Create a registry client for the given publish context.
 */
function createClientForContext(ctx: PublishContext): RegistryClient & DefaultRegistryOperations {
  const localConfig = getLocalConfig(ctx.projectRoot);
  const registry = resolveRegistry(ctx.scope, localConfig, ctx.projectRoot);
  return createRegistryClient(registry) as RegistryClient & DefaultRegistryOperations;
}

/**
 * Publisher for the default API-based registry.
 */
export class ApiPublisher implements Publisher {
  readonly type = "api";

  async versionExists(ctx: PublishContext): Promise<boolean> {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return false;
    }

    const client = createClientForContext(ctx);
    try {
      return await client.versionExists(ctx.artifactId, ctx.version);
    } catch (err) {
      logger.debug("ApiPublisher.versionExists failed:", ctx.artifactId, ctx.version, err);
      return false;
    }
  }

  async getLatestVersion(ctx: PublishContext): Promise<string | null> {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return null;
    }

    const client = createClientForContext(ctx);
    try {
      return await client.getLatestVersion(ctx.artifactId);
    } catch (err) {
      logger.debug("ApiPublisher.getLatestVersion failed:", ctx.artifactId, err);
      return null;
    }
  }

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return {
        success: false,
        error: "Not logged in. Run 'grekt login' first.",
      };
    }

    const client = createClientForContext(ctx);

    try {
      const { uploadUrl } = await client.requestPublish({
        artifactId: ctx.artifactId,
        version: ctx.version,
        categories: ctx.categories,
        description: ctx.description,
        keywords: ctx.keywords,
        private: ctx.isPrivate,
        license: ctx.license,
        repository: ctx.repositoryUrl,
      });

      // Upload tarball to signed URL
      const fileBuffer = fs.readFileBinary(ctx.tarballPath);
      const uploadResponse = await http.fetch(uploadUrl, {
        method: "PUT",
        body: new Uint8Array(fileBuffer),
        headers: { "Content-Type": "application/gzip" },
      });

      if (!uploadResponse.ok) {
        return {
          success: false,
          error: `Upload failed: ${uploadResponse.status}`,
        };
      }

      // Confirm publish to trigger tarball extraction for file browsing
      try {
        await client.confirmPublish({
          artifactId: ctx.artifactId,
          version: ctx.version,
          license: ctx.license,
          repositoryUrl: ctx.repositoryUrl,
        });
      } catch (confirmErr) {
        // Log but don't fail the publish - extraction is optional for MVP
        logger.debug("Failed to extract files for browsing:", confirmErr);
      }

      return { success: true };
    } catch (err) {
      if (err instanceof RegistryApiError) {
        throw err;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

/**
 * Check if user is authenticated for API publishing.
 * Returns false if Supabase is not configured.
 */
export async function isApiAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }
  try {
    return await isAuthenticated();
  } catch (err) {
    logger.debug("isApiAuthenticated failed:", err);
    return false;
  }
}
