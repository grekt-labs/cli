import { logger } from "#/shared/logger/logger";
import type { ArtifactMetadata } from "@grekt-labs/cli-engine";
import { sortVersionsDesc, getHighestVersion, validateTarballContents, generateSecureTempPath } from "@grekt-labs/cli-engine";
import { getSupabaseClient, getSession, getSupabaseUrl } from "#/auth/session/session";
import { fs, http, tarOps } from "#/context";
import type { RegistryErrorResponse } from "./api-client.types";
import type { DeprecateOptions, PublishRequest } from "#/registry/registry.types";
import { RegistryError } from "./registry-error";

export type { PublishRequest };

export interface VersionInfo {
  version: string;
  deprecated?: string;
  createdAt: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
  version?: string;
  resolved?: string;
  deprecationMessage?: string;
}

export interface PublishResult {
  uploadUrl: string;
  expiresAt: string;
}

export interface ConfirmPublishOptions {
  artifactId: string;
  version: string;
  license?: string;
  repositoryUrl?: string;
}

export interface WhoamiResult {
  email: string;
}

/**
 * Registry client using Supabase SDK.
 * All Supabase-specific code is contained here.
 */
export class RegistryClient {
  private edgeFunctionUrl: string;

  constructor(edgeFunctionUrl?: string) {
    this.edgeFunctionUrl = edgeFunctionUrl || `${getSupabaseUrl()}/functions/v1`;
  }

  private async parseErrorResponse(response: Response): Promise<RegistryErrorResponse> {
    try {
      const body = await response.json();
      if (body && typeof body.error === "string" && typeof body.code === "string") {
        return body as RegistryErrorResponse;
      }
    } catch (err) {
      logger.debug("Failed to parse error response JSON:", err);
    }

    return {
      error: `Request failed with status ${response.status}`,
      code: "UNKNOWN",
    };
  }

  // ============================================================================
  // Public endpoints (no auth required) - Direct Supabase queries
  // ============================================================================

  /**
   * Get artifact metadata (transformed to match expected interface)
   */
  async getArtifact(artifactId: string): Promise<ArtifactMetadata | null> {
    try {
      const supabase = getSupabaseClient();

      // Get artifact
      const { data: artifact, error: artifactError } = await supabase
        .from("artifacts")
        .select("*")
        .eq("id", artifactId)
        .eq("is_public", true)
        .single();

      if (artifactError || !artifact) return null;

      // Get versions
      const { data: versions, error: versionsError } = await supabase
        .from("versions")
        .select("*")
        .eq("artifact_id", artifactId);

      if (versionsError) return null;

      // Find latest version by semver (highest version, not most recent publish)
      const versionStrings = (versions || []).map(v => v.version);
      const latest = getHighestVersion(versionStrings) || "";

      // Build deprecated record
      const deprecated: Record<string, string> = {};
      for (const v of versions || []) {
        if (v.deprecated_message) {
          deprecated[v.version] = v.deprecated_message;
        }
      }

      // Find most recent update timestamp
      const sortedByDate = [...(versions || [])].sort(
        (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );

      return {
        name: artifact.id,
        latest,
        deprecated,
        createdAt: artifact.created_at,
        updatedAt: sortedByDate[0]?.published_at || artifact.created_at,
      };
    } catch (err) {
      logger.debug("getArtifact failed:", artifactId, err);
      return null;
    }
  }

  /**
   * Get all versions for an artifact (sorted by semver descending)
   */
  async getVersions(artifactId: string): Promise<VersionInfo[]> {
    try {
      const supabase = getSupabaseClient();

      const { data: versions, error } = await supabase
        .from("versions")
        .select("version, deprecated_message, published_at")
        .eq("artifact_id", artifactId);

      if (error || !versions) return [];

      // Build version info map
      const versionMap = new Map<string, VersionInfo>();
      for (const v of versions) {
        versionMap.set(v.version, {
          version: v.version,
          deprecated: v.deprecated_message || undefined,
          createdAt: v.published_at,
        });
      }

      // Sort by semver descending (highest version first)
      const sortedVersions = sortVersionsDesc(versions.map(v => v.version));

      return sortedVersions.map(version => versionMap.get(version)!);
    } catch (err) {
      logger.debug("getVersions failed:", artifactId, err);
      return [];
    }
  }

  /**
   * Download artifact tarball using Edge Function for signed URLs
   */
  async download(artifactId: string, options: { version?: string; targetDir: string }): Promise<DownloadResult> {
    try {
      const { version, targetDir } = options;

      // If no version specified, get latest from metadata
      let resolvedVersion = version;
      if (!resolvedVersion) {
        const metadata = await this.getArtifact(artifactId);
        if (!metadata) {
          return { success: false, error: "Artifact not found in registry" };
        }
        resolvedVersion = metadata.latest;
        if (!resolvedVersion) {
          return { success: false, error: "No versions available for this artifact" };
        }
      }

      // Build download URL with optional auth
      const session = await getSession();
      const downloadUrl = new URL(`${this.edgeFunctionUrl}/download`);
      downloadUrl.searchParams.set("artifact", artifactId);
      downloadUrl.searchParams.set("version", resolvedVersion);

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "User-Agent": "grekt-cli",
      };

      if (session) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // Get signed URL from Edge Function
      const urlResponse = await http.fetch(downloadUrl.toString(), { headers });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json().catch(() => null);
        if (urlResponse.status === 404) {
          const code = errorData?.code;
          if (code === "ARTIFACT_NOT_FOUND") {
            return { success: false, error: "Artifact not found in registry" };
          }
          if (code === "VERSION_NOT_FOUND") {
            return { success: false, error: `Version ${resolvedVersion} not found` };
          }
          if (code === "FILE_NOT_FOUND") {
            return { success: false, error: "Artifact file not found in storage" };
          }
          return { success: false, error: errorData?.error || "Not found" };
        }
        if (urlResponse.status === 401 || urlResponse.status === 403) {
          return { success: false, error: "Access denied (check authentication)" };
        }
        return { success: false, error: errorData?.error || `Registry returned ${urlResponse.status}` };
      }

      const { url: tarballUrl, deprecated } = await urlResponse.json();

      // Download the actual tarball from signed URL
      const response = await http.fetch(tarballUrl, {
        headers: { "User-Agent": "grekt-cli" },
      });

      if (!response.ok) {
        return { success: false, error: `Download failed: ${response.status}` };
      }

      const buffer = await response.arrayBuffer();
      const tempTarball = generateSecureTempPath("api-client");
      fs.writeFileBinary(tempTarball, Buffer.from(buffer));

      // Validate tarball contents BEFORE extraction (prevents path traversal)
      // stripComponents=1 matches the extraction below
      const validation = validateTarballContents(tarOps, tempTarball, targetDir, 1);
      if (!validation.safe) {
        fs.unlink(tempTarball);
        return { success: false, error: "Security: tarball failed validation" };
      }

      fs.mkdir(targetDir, { recursive: true });
      tarOps.extract({ tarballPath: tempTarball, targetDir, gzip: true, stripComponents: 1 });
      fs.unlink(tempTarball);

      return {
        success: true,
        version: resolvedVersion,
        resolved: tarballUrl,
        deprecationMessage: deprecated || undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
        return { success: false, error: "Cannot reach registry (network error)" };
      }
      return { success: false, error: message };
    }
  }

  /**
   * Check if a version exists
   */
  async versionExists(artifactId: string, version: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("versions")
        .select("version")
        .eq("artifact_id", artifactId)
        .eq("version", version)
        .single();

      return !error && !!data;
    } catch (err) {
      logger.debug("versionExists failed:", artifactId, version, err);
      return false;
    }
  }

  /**
   * Get the latest version of an artifact
   */
  async getLatestVersion(artifactId: string): Promise<string | null> {
    const metadata = await this.getArtifact(artifactId);
    return metadata?.latest ?? null;
  }

  // ============================================================================
  // Authenticated endpoints - Supabase Auth + RLS / Edge Functions
  // ============================================================================

  /**
   * Get current user info
   */
  async whoami(): Promise<WhoamiResult | null> {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) return null;

      return { email: user.email || "" };
    } catch (err) {
      logger.debug("whoami failed:", err);
      return null;
    }
  }

  /**
   * Request upload URL for publishing (calls Edge Function)
   */
  async publish(request: PublishRequest): Promise<PublishResult> {
    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await http.fetch(`${this.edgeFunctionUrl}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw new RegistryError(errorData.error, errorData.code, errorData.details);
    }

    return await response.json();
  }

  /**
   * Deprecate a version (calls Edge Function for ownership validation)
   */
  async deprecate(artifactId: string, options: DeprecateOptions): Promise<void> {
    const { version, message } = options;

    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await http.fetch(`${this.edgeFunctionUrl}/deprecate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ artifactId, version, message }),
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw new RegistryError(errorData.error, errorData.code, errorData.details);
    }
  }

  /**
   * Remove deprecation from a version (calls Edge Function for ownership validation)
   */
  async undeprecate(artifactId: string, version: string): Promise<void> {
    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await http.fetch(`${this.edgeFunctionUrl}/undeprecate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ artifactId, version }),
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw new RegistryError(errorData.error, errorData.code, errorData.details);
    }
  }

  /**
   * Confirm publish and trigger tarball extraction (calls Edge Function)
   * This extracts the tarball contents for file browsing in the web UI.
   */
  async confirmPublish(options: ConfirmPublishOptions): Promise<void> {
    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await http.fetch(`${this.edgeFunctionUrl}/publish-confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        artifactId: options.artifactId,
        version: options.version,
        license: options.license,
        repository: options.repositoryUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw new RegistryError(errorData.error, errorData.code, errorData.details);
    }
  }
}

/**
 * Factory to create a registry client
 */
export function createRegistryClient(projectRoot?: string): RegistryClient {
  return new RegistryClient();
}
