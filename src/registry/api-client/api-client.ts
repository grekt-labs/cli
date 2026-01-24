import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import type { ArtifactMetadata } from "#/schemas/index";
import { getSupabaseClient, getSession, SUPABASE_URL } from "#/auth/session/session";

// Registry public URL for tarballs
const REGISTRY_URL = "https://registry.grekt.com";

export interface VersionInfo {
  version: string;
  deprecated?: string;
  createdAt: string;
}

export interface DownloadResult {
  success: boolean;
  version?: string;
  resolved?: string;
  deprecationMessage?: string;
}

export interface PublishResult {
  uploadUrl: string;
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
    this.edgeFunctionUrl = edgeFunctionUrl || `${SUPABASE_URL}/functions/v1`;
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
        .eq("artifact_id", artifactId)
        .order("published_at", { ascending: false });

      if (versionsError) return null;

      // Find latest version (first one, since ordered by published_at desc)
      const latest = versions?.[0]?.version || "";

      // Build deprecated record
      const deprecated: Record<string, string> = {};
      for (const v of versions || []) {
        if (v.deprecated_message) {
          deprecated[v.version] = v.deprecated_message;
        }
      }

      return {
        name: artifact.id,
        latest,
        deprecated,
        createdAt: artifact.created_at,
        updatedAt: versions?.[0]?.published_at || artifact.created_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all versions for an artifact
   */
  async getVersions(artifactId: string): Promise<VersionInfo[]> {
    try {
      const supabase = getSupabaseClient();

      const { data: versions, error } = await supabase
        .from("versions")
        .select("version, deprecated_message, published_at")
        .eq("artifact_id", artifactId)
        .order("published_at", { ascending: false });

      if (error || !versions) return [];

      return versions.map((v) => ({
        version: v.version,
        deprecated: v.deprecated_message || undefined,
        createdAt: v.published_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Download artifact tarball
   */
  async download(artifactId: string, version: string | undefined, targetDir: string): Promise<DownloadResult> {
    try {
      const metadata = await this.getArtifact(artifactId);
      if (!metadata) {
        return { success: false };
      }

      const resolvedVersion = version || metadata.latest;
      const tarballUrl = `${REGISTRY_URL}/${artifactId}/${resolvedVersion}.tar.gz`;
      const deprecationMessage = metadata.deprecated[resolvedVersion];

      const response = await fetch(tarballUrl, {
        headers: { "User-Agent": "grekt-cli" },
      });

      if (!response.ok) {
        return { success: false };
      }

      const buffer = await response.arrayBuffer();
      const tempTarball = `/tmp/grekt-${Date.now()}.tar.gz`;
      writeFileSync(tempTarball, Buffer.from(buffer));

      mkdirSync(targetDir, { recursive: true });
      execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
        stdio: "pipe",
      });
      execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

      return {
        success: true,
        version: resolvedVersion,
        resolved: tarballUrl,
        deprecationMessage,
      };
    } catch {
      return { success: false };
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
    } catch {
      return false;
    }
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
    } catch {
      return null;
    }
  }

  /**
   * Request upload URL for publishing (calls Edge Function)
   */
  async publish(artifactId: string, version: string): Promise<PublishResult> {
    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${this.edgeFunctionUrl}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ artifactId, version }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to get upload URL: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Deprecate a version (direct Supabase update, RLS checks ownership)
   */
  async deprecate(artifactId: string, version: string, message: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("versions")
      .update({ deprecated_message: message })
      .eq("artifact_id", artifactId)
      .eq("version", version);

    if (error) {
      throw new Error(`Failed to deprecate: ${error.message}`);
    }
  }

  /**
   * Remove deprecation from a version (direct Supabase update, RLS checks ownership)
   */
  async undeprecate(artifactId: string, version: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("versions")
      .update({ deprecated_message: null })
      .eq("artifact_id", artifactId)
      .eq("version", version);

    if (error) {
      throw new Error(`Failed to undeprecate: ${error.message}`);
    }
  }
}

/**
 * Factory to create a registry client
 */
export function createRegistryClient(projectRoot?: string): RegistryClient {
  return new RegistryClient();
}
