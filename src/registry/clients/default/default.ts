/**
 * Default registry client
 *
 * Implementation for the public registry.grekt.com.
 * Uses simple HTTP fetches to download artifacts and metadata.
 */

import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import type {
  RegistryClient,
  ResolvedRegistry,
  DownloadResult,
  PublishResult,
} from "#/registry/registry.types";
import type { ArtifactMetadata } from "#/schemas/index";

export class DefaultRegistryClient implements RegistryClient {
  private host: string;

  constructor(registry: ResolvedRegistry) {
    this.host = registry.host;
  }

  private getBaseUrl(): string {
    return `https://${this.host}`;
  }

  /**
   * Fetch artifact metadata from registry
   */
  private async fetchMetadata(artifactId: string): Promise<ArtifactMetadata | null> {
    const metadataUrl = `${this.getBaseUrl()}/${artifactId}/metadata.json`;

    try {
      const response = await fetch(metadataUrl);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async download(
    artifactId: string,
    version: string | undefined,
    targetDir: string
  ): Promise<DownloadResult> {
    const metadata = await this.fetchMetadata(artifactId);
    if (!metadata) {
      return { success: false };
    }

    const resolvedVersion = version || metadata.latest;
    const tarballUrl = `${this.getBaseUrl()}/${artifactId}/${resolvedVersion}.tar.gz`;
    const deprecationMessage = metadata.deprecated[resolvedVersion];

    try {
      const response = await fetch(tarballUrl);
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

  async publish(
    _artifactId: string,
    _version: string,
    _tarballPath: string
  ): Promise<PublishResult> {
    // Default registry publishing requires API authentication
    // This is handled separately via the Supabase client
    return {
      success: false,
      error: "Publishing to default registry requires 'grekt login'. Use --s3 or configure a GitLab registry.",
    };
  }

  async getLatestVersion(artifactId: string): Promise<string | null> {
    const metadata = await this.fetchMetadata(artifactId);
    return metadata?.latest ?? null;
  }

  async versionExists(artifactId: string, version: string): Promise<boolean> {
    const metadata = await this.fetchMetadata(artifactId);
    if (!metadata) return false;

    // Check if version exists by trying to fetch it
    const tarballUrl = `${this.getBaseUrl()}/${artifactId}/${version}.tar.gz`;
    try {
      const response = await fetch(tarballUrl, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listVersions(_artifactId: string): Promise<string[]> {
    // Default registry doesn't expose version list via metadata
    // Return empty array - caller should use getLatestVersion
    return [];
  }
}
