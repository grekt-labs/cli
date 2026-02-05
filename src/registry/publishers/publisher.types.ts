/**
 * Result of a publish operation.
 */
export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Context passed to publishers with all necessary information.
 */
export interface PublishContext {
  artifactId: string;
  version: string;
  tarballPath: string;
  scope: string;
  projectRoot: string;
  description?: string;
  keywords?: string[];
  isPrivate?: boolean;
}

/**
 * Publisher interface - Strategy pattern for different registry types.
 */
export interface Publisher {
  /**
   * Unique identifier for this publisher type.
   */
  readonly type: string;

  /**
   * Check if a version already exists.
   */
  versionExists(ctx: PublishContext): Promise<boolean>;

  /**
   * Publish the artifact.
   */
  publish(ctx: PublishContext): Promise<PublishResult>;
}
