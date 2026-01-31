import { mkdirSync, writeFileSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import type { ArtifactMetadata, ShellExecutor } from "@grekt-labs/cli-engine";
import { sortVersionsDesc, getHighestVersion, validateTarballContents } from "@grekt-labs/cli-engine";
import { getSupabaseClient, getSession, SUPABASE_URL } from "#/auth/session/session";
import { REGISTRY_URL } from "#/constants";

/**
 * Minimal ShellExecutor adapter for validateTarballContents.
 */
const shellAdapter: ShellExecutor = {
  execFile: (command: string, args: string[]) => {
    return execFileSync(command, args, { stdio: "pipe" }).toString();
  },
};



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
    } catch {
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
      const tempTarball = `/tmp/grekt-${randomUUID()}.tar.gz`;
      writeFileSync(tempTarball, Buffer.from(buffer));

      // Validate tarball contents BEFORE extraction (prevents path traversal)
      // stripComponents=1 matches the extraction below
      const validation = validateTarballContents(shellAdapter, tempTarball, targetDir, 1);
      if (!validation.safe) {
        rmSync(tempTarball, { force: true });
        return { success: false };
      }

      mkdirSync(targetDir, { recursive: true });
      execFileSync("tar", ["-xzf", tempTarball, "-C", targetDir, "--strip-components=1"], {
        stdio: "pipe",
      });
      rmSync(tempTarball, { force: true });

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
