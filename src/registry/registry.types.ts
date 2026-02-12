/**
 * Registry types and interfaces
 *
 * Core abstraction layer for registry operations.
 * The core NEVER knows what GitLab/GitHub is - only that there's
 * "a registry client" with download/publish methods.
 */

import type { PublishResult } from "./publishers/publisher.types";

export type { PublishResult };

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
  prefix?: string;
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
 * Options for downloading an artifact
 */
export interface DownloadOptions {
  version?: string;
  targetDir: string;
}

/**
 * Options for deprecating a version
 */
export interface DeprecateOptions {
  version: string;
  message: string;
}

/**
 * Request payload for publishing an artifact
 */
export interface PublishRequest {
  artifactId: string;
  version: string;
  categories: string[];
  description?: string;
  keywords?: string[];
  private?: boolean;
  license?: string;
  repository?: string;
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
    options: DownloadOptions
  ): Promise<DownloadResult>;

  /**
   * Publish an artifact tarball
   */
  publish(request: PublishRequest): Promise<PublishResult>;

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
  prefix?: string;
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
