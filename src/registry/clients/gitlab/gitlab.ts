/**
 * GitLab Generic Package Registry client
 *
 * Implementation for self-hosted artifact registries using GitLab's
 * Generic Package Registry feature.
 *
 * All GitLab-specific logic is isolated here - the core never knows
 * what GitLab is.
 *
 * @see https://docs.gitlab.com/ee/user/packages/generic_packages/
 */

import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { execSync } from "child_process";
import type {
  RegistryClient,
  ResolvedRegistry,
  DownloadResult,
  PublishResult,
} from "#/registry/registry.types";

interface GitLabPackage {
  id: number;
  name: string;
  version: string;
  package_type: string;
  created_at: string;
}

interface GitLabPackageFile {
  id: number;
  file_name: string;
  size: number;
  file_sha256: string;
}

export class GitLabRegistryClient implements RegistryClient {
  private host: string;
  private project: string;
  private token?: string;
  private projectId?: string; // cached

  constructor(registry: ResolvedRegistry) {
    if (!registry.project) {
      throw new Error("GitLab registry requires 'project' field in config");
    }

    this.host = registry.host;
    this.project = registry.project;
    this.token = registry.token;
  }

  /**
   * Get request headers for GitLab API
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": "grekt-cli",
    };
    if (this.token) {
      headers["PRIVATE-TOKEN"] = this.token;
    }
    return headers;
  }

  /**
   * Get the numeric project ID from GitLab API
   * Required because some endpoints need numeric ID, not path
   */
  private async getProjectId(): Promise<string> {
    if (this.projectId) return this.projectId;

    const encodedPath = encodeURIComponent(this.project);
    const url = `https://${this.host}/api/v4/projects/${encodedPath}`;

    const response = await fetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      throw new Error(`Failed to get project info: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.projectId = String(data.id);
    return this.projectId;
  }

  /**
   * Encode artifact name for GitLab API
   * @scope/name → %40scope%2Fname
   */
  private encodePackageName(artifactId: string): string {
    return encodeURIComponent(artifactId);
  }

  /**
   * List all packages matching the artifact name
   */
  private async listPackages(artifactId: string): Promise<GitLabPackage[]> {
    const projectId = await this.getProjectId();
    const encodedName = this.encodePackageName(artifactId);

    // GitLab API: GET /projects/:id/packages?package_type=generic&package_name=:name
    const url = `https://${this.host}/api/v4/projects/${projectId}/packages?package_type=generic&package_name=${encodedName}`;

    const response = await fetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Failed to list packages: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get files for a specific package version
   */
  private async getPackageFiles(packageId: number): Promise<GitLabPackageFile[]> {
    const projectId = await this.getProjectId();
    const url = `https://${this.host}/api/v4/projects/${projectId}/packages/${packageId}/package_files`;

    const response = await fetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      throw new Error(`Failed to get package files: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async download(
    artifactId: string,
    version: string | undefined,
    targetDir: string
  ): Promise<DownloadResult> {
    try {
      const projectId = await this.getProjectId();
      const encodedName = this.encodePackageName(artifactId);

      // If no version specified, get the latest
      let resolvedVersion = version;
      if (!resolvedVersion) {
        const latest = await this.getLatestVersion(artifactId);
        if (!latest) {
          return { success: false };
        }
        resolvedVersion = latest;
      }

      // Download URL for generic package file
      // GET /projects/:id/packages/generic/:package_name/:package_version/:file_name
      const fileName = "artifact.tar.gz";
      const url = `https://${this.host}/api/v4/projects/${projectId}/packages/generic/${encodedName}/${resolvedVersion}/${fileName}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
        redirect: "follow",
      });

      if (!response.ok) {
        return { success: false };
      }

      const buffer = await response.arrayBuffer();
      const tempTarball = `/tmp/grekt-gitlab-${Date.now()}.tar.gz`;
      writeFileSync(tempTarball, Buffer.from(buffer));

      mkdirSync(targetDir, { recursive: true });
      execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
        stdio: "pipe",
      });
      execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

      return {
        success: true,
        version: resolvedVersion,
        resolved: url,
      };
    } catch {
      return { success: false };
    }
  }

  async publish(
    artifactId: string,
    version: string,
    tarballPath: string
  ): Promise<PublishResult> {
    if (!this.token) {
      return {
        success: false,
        error: "GitLab registry requires authentication. Set token in .grekt/config.yaml or GITLAB_TOKEN env var.",
      };
    }

    try {
      const projectId = await this.getProjectId();
      const encodedName = this.encodePackageName(artifactId);
      const fileName = "artifact.tar.gz";

      // Upload URL for generic package file
      // PUT /projects/:id/packages/generic/:package_name/:package_version/:file_name
      const url = `https://${this.host}/api/v4/projects/${projectId}/packages/generic/${encodedName}/${version}/${fileName}`;

      const body = readFileSync(tarballPath);

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/gzip",
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Upload failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return {
        success: true,
        url,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async getLatestVersion(artifactId: string): Promise<string | null> {
    const versions = await this.listVersions(artifactId);
    return versions.length > 0 ? versions[0]! : null;
  }

  async versionExists(artifactId: string, version: string): Promise<boolean> {
    const versions = await this.listVersions(artifactId);
    return versions.includes(version);
  }

  async listVersions(artifactId: string): Promise<string[]> {
    try {
      const packages = await this.listPackages(artifactId);

      // Sort by created_at descending (newest first)
      packages.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return packages.map(p => p.version);
    } catch {
      return [];
    }
  }
}
