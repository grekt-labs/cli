import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Credentials } from "@grekt-labs/cli-engine";
import { fs } from "#/context";
import {
  getArtifactMetadata,
  saveArtifactMetadata,
  versionExists as checkS3VersionExists,
  createMetadata,
  updateMetadataVersion,
} from "#/registry/metadata/metadata";
import type { Publisher, PublishContext, PublishResult } from "./publisher.types";

/**
 * Get S3 credentials from environment variables.
 * Used for CI/CD workflows.
 */
export function getS3CredentialsFromEnv(): S3Credentials | undefined {
  const {
    GREKT_STORAGE_ENDPOINT,
    GREKT_STORAGE_ACCESS_KEY_ID,
    GREKT_STORAGE_SECRET_ACCESS_KEY,
    GREKT_STORAGE_BUCKET,
    GREKT_STORAGE_PUBLIC_URL,
    // Legacy env vars (backwards compat)
    STORAGE_ENDPOINT,
    STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY,
    STORAGE_BUCKET,
    STORAGE_PUBLIC_URL,
  } = process.env;

  const endpoint = GREKT_STORAGE_ENDPOINT || STORAGE_ENDPOINT;
  const accessKeyId = GREKT_STORAGE_ACCESS_KEY_ID || STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = GREKT_STORAGE_SECRET_ACCESS_KEY || STORAGE_SECRET_ACCESS_KEY;
  const bucket = GREKT_STORAGE_BUCKET || STORAGE_BUCKET;
  const publicUrl = GREKT_STORAGE_PUBLIC_URL || STORAGE_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return undefined;
  }

  return {
    type: "s3",
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
  };
}

/**
 * Publisher for S3-compatible storage (legacy mode).
 * Credentials are only read from environment variables.
 */
export class S3Publisher implements Publisher {
  readonly type = "s3";
  private credentials: S3Credentials | undefined = undefined;

  /**
   * Get credentials from environment variables.
   */
  private getCredentials(): S3Credentials | undefined {
    if (this.credentials) {
      return this.credentials;
    }

    this.credentials = getS3CredentialsFromEnv();
    return this.credentials;
  }

  /**
   * Check if credentials are available.
   */
  hasCredentials(): boolean {
    return this.getCredentials() !== undefined;
  }

  async versionExists(ctx: PublishContext): Promise<boolean> {
    const credentials = this.getCredentials();
    if (!credentials) {
      return false;
    }

    try {
      return await checkS3VersionExists(credentials, ctx.artifactId, ctx.version);
    } catch {
      return false;
    }
  }

  async getLatestVersion(ctx: PublishContext): Promise<string | null> {
    const credentials = this.getCredentials();
    if (!credentials) {
      return null;
    }

    try {
      const metadata = await getArtifactMetadata(credentials, ctx.artifactId);
      return metadata?.latest ?? null;
    } catch {
      return null;
    }
  }

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const credentials = this.getCredentials();

    if (!credentials) {
      return {
        success: false,
        error: "No S3 credentials found",
      };
    }

    const client = new S3Client({
      region: "auto",
      endpoint: credentials.endpoint,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const key = `artifacts/${ctx.artifactId}/${ctx.version}.tar.gz`;
    const body = fs.readFileBinary(ctx.tarballPath);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: credentials.bucket,
          Key: key,
          Body: body,
          ContentType: "application/gzip",
        })
      );

      // Update metadata
      let metadata = await getArtifactMetadata(credentials, ctx.artifactId);
      if (metadata) {
        metadata = updateMetadataVersion(metadata, ctx.version);
      } else {
        metadata = createMetadata(ctx.artifactId, ctx.version);
      }
      await saveArtifactMetadata(credentials, metadata);

      const url = credentials.publicUrl ? `${credentials.publicUrl}/${key}` : undefined;

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
}
