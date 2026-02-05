import { isAuthenticated, isSupabaseConfigured } from "#/auth/session/session";
import { fs, http } from "#/context";
import { createRegistryClient } from "#/registry/api-client/api-client";
import type { Publisher, PublishContext, PublishResult } from "./publisher.types";

/**
 * Publisher for the default API-based registry (Supabase).
 */
export class ApiPublisher implements Publisher {
  readonly type = "api";

  async versionExists(ctx: PublishContext): Promise<boolean> {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return false;
    }

    const client = createRegistryClient();
    try {
      return await client.versionExists(ctx.artifactId, ctx.version);
    } catch {
      return false;
    }
  }

  async getLatestVersion(ctx: PublishContext): Promise<string | null> {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return null;
    }

    const client = createRegistryClient();
    try {
      return await client.getLatestVersion(ctx.artifactId);
    } catch {
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

    const client = createRegistryClient();

    try {
      const { uploadUrl } = await client.publish({
        artifactId: ctx.artifactId,
        version: ctx.version,
        description: ctx.description,
        keywords: ctx.keywords,
        private: ctx.isPrivate,
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

      return { success: true };
    } catch (err) {
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
  } catch {
    return false;
  }
}
