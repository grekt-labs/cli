/**
 * Registry types and interfaces
 *
 * Core abstraction layer for registry operations.
 * The core NEVER knows what GitLab/GitHub is - only that there's
 * "a registry client" with download/publish methods.
 */

export type RegistryType = "gitlab" | "github" | "default";

/**
 * Normalized registry configuration.
 * Created by resolver from raw config, used by factory to create clients.
 */
export interface ResolvedRegistry {
  type: RegistryType;
  host: string;
  project?: string;
  token?: string;
  folder?: string;
}

/**
 * Result from download operation
 */
export interface DownloadResult {
  success: boolean;
  version?: string;
  resolved?: string;
  deprecationMessage?: string;
}

/**
 * Result from publish operation
 */
export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Registry client interface.
 * All registry implementations must implement this interface.
 */
export interface RegistryClient {
  /**
   * Download an artifact to the target directory
   */
  download(
    artifactId: string,
    version: string | undefined,
    targetDir: string
  ): Promise<DownloadResult>;

  /**
   * Publish an artifact tarball
   */
  publish(
    artifactId: string,
    version: string,
    tarballPath: string
  ): Promise<PublishResult>;

  /**
   * Get the latest version of an artifact
   */
  getLatestVersion(artifactId: string): Promise<string | null>;

  /**
   * Check if a specific version exists
   */
  versionExists(artifactId: string, version: string): Promise<boolean>;

  /**
   * List all versions of an artifact (sorted desc by default)
   */
  listVersions(artifactId: string): Promise<string[]>;
}

/**
 * Registry entry in local config (.grekt/config.yaml)
 */
export interface RegistryEntry {
  type: RegistryType;
  project?: string;
  host?: string;
  token?: string;
  folder?: string;
}

/**
 * Local config file schema (.grekt/config.yaml)
 */
export interface LocalConfig {
  registries?: Record<string, RegistryEntry>;
}

/**
 * Registry provider for interactive configuration.
 * Each provider handles prompts for its specific registry type.
 */
export interface RegistryProvider {
  type: Exclude<RegistryType, "default">;
  label: string;
  prompts(): Promise<Omit<RegistryEntry, "type">>;
}
