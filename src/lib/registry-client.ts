import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import type { ArtifactMetadata } from "#/schemas/index";
import { getRegistryToken, getRegistryUrl } from "#/lib/credentials";

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
 * Registry API client. Backend-agnostic - only speaks REST.
 */
export class RegistryClient {
  constructor(
    private baseUrl: string,
    private getToken: () => string | undefined
  ) {}

  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "User-Agent": "grekt-cli",
      ...(options?.headers as Record<string, string>),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${this.baseUrl}${path}`, { ...options, headers });
  }

  // ============================================================================
  // Public endpoints (no auth required)
  // ============================================================================

  /**
   * Get artifact metadata
   */
  async getArtifact(artifactId: string): Promise<ArtifactMetadata | null> {
    try {
      const response = await this.fetch(`/artifacts/${encodeURIComponent(artifactId)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get all versions for an artifact
   */
  async getVersions(artifactId: string): Promise<VersionInfo[]> {
    try {
      const response = await this.fetch(`/artifacts/${encodeURIComponent(artifactId)}/versions`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  /**
   * Download artifact tarball
   */
  async download(artifactId: string, version: string | undefined, targetDir: string): Promise<DownloadResult> {
    try {
      // First, get metadata to resolve version
      const metadata = await this.getArtifact(artifactId);
      if (!metadata) {
        return { success: false };
      }

      const resolvedVersion = version || metadata.latest;
      const tarballUrl = `${this.baseUrl}/artifacts/${encodeURIComponent(artifactId)}/${resolvedVersion}.tar.gz`;
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

  // ============================================================================
  // Authenticated endpoints (token required)
  // ============================================================================

  /**
   * Get current user info. Returns null if not authenticated.
   */
  async whoami(): Promise<WhoamiResult | null> {
    try {
      const response = await this.fetch("/auth/whoami");
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Request upload URL for publishing
   */
  async publish(artifactId: string, version: string): Promise<PublishResult> {
    const response = await this.fetch(`/artifacts/${encodeURIComponent(artifactId)}/versions/${version}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to get upload URL: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Deprecate a version
   */
  async deprecate(artifactId: string, version: string, message: string): Promise<void> {
    const response = await this.fetch(
      `/artifacts/${encodeURIComponent(artifactId)}/versions/${version}/deprecate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to deprecate: ${response.status}`);
    }
  }

  /**
   * Remove deprecation from a version
   */
  async undeprecate(artifactId: string, version: string): Promise<void> {
    const response = await this.fetch(
      `/artifacts/${encodeURIComponent(artifactId)}/versions/${version}/undeprecate`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to undeprecate: ${response.status}`);
    }
  }

  /**
   * Check if a version exists
   */
  async versionExists(artifactId: string, version: string): Promise<boolean> {
    try {
      const response = await this.fetch(
        `/artifacts/${encodeURIComponent(artifactId)}/versions/${version}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Factory to create a registry client with default configuration
 */
export function createRegistryClient(projectRoot?: string): RegistryClient {
  const url = getRegistryUrl(projectRoot);
  return new RegistryClient(url, () => getRegistryToken());
}
