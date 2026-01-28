import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { S3Credentials, ArtifactMetadata } from "@grekt-labs/cli-engine";
import { ArtifactMetadataSchema, sortVersionsDesc } from "@grekt-labs/cli-engine";

function createS3Client(credentials: S3Credentials): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: credentials.endpoint,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

function getMetadataKey(artifactId: string): string {
  return `artifacts/${artifactId}/metadata.json`;
}

function getTarballKey(artifactId: string, version: string): string {
  return `artifacts/${artifactId}/${version}.tar.gz`;
}

export async function getArtifactMetadata(
  credentials: S3Credentials,
  artifactId: string
): Promise<ArtifactMetadata | null> {
  const client = createS3Client(credentials);
  const key = getMetadataKey(artifactId);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: credentials.bucket,
        Key: key,
      })
    );

    const body = await response.Body?.transformToString();
    if (!body) return null;

    return ArtifactMetadataSchema.parse(JSON.parse(body));
  } catch (err: unknown) {
    if (err && typeof err === "object" && "name" in err && err.name === "NoSuchKey") {
      return null;
    }
    throw err;
  }
}

export async function saveArtifactMetadata(
  credentials: S3Credentials,
  metadata: ArtifactMetadata
): Promise<void> {
  const client = createS3Client(credentials);
  const key = getMetadataKey(metadata.name);

  await client.send(
    new PutObjectCommand({
      Bucket: credentials.bucket,
      Key: key,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: "application/json",
    })
  );
}

export async function versionExists(
  credentials: S3Credentials,
  artifactId: string,
  version: string
): Promise<boolean> {
  const client = createS3Client(credentials);
  const key = getTarballKey(artifactId, version);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: credentials.bucket,
        Key: key,
      })
    );
    return true;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "name" in err && err.name === "NotFound") {
      return false;
    }
    throw err;
  }
}

export function createMetadata(artifactId: string, version: string): ArtifactMetadata {
  const now = new Date().toISOString();
  return {
    name: artifactId,
    latest: version,
    deprecated: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMetadataVersion(
  metadata: ArtifactMetadata,
  version: string
): ArtifactMetadata {
  return {
    ...metadata,
    latest: version,
    updatedAt: new Date().toISOString(),
  };
}

export function deprecateVersion(
  metadata: ArtifactMetadata,
  version: string,
  message: string
): ArtifactMetadata {
  return {
    ...metadata,
    deprecated: {
      ...metadata.deprecated,
      [version]: message,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function undeprecateVersion(
  metadata: ArtifactMetadata,
  version: string
): ArtifactMetadata {
  const { [version]: _, ...remainingDeprecated } = metadata.deprecated;
  return {
    ...metadata,
    deprecated: remainingDeprecated,
    updatedAt: new Date().toISOString(),
  };
}

export async function listVersions(
  credentials: S3Credentials,
  artifactId: string
): Promise<string[]> {
  const client = createS3Client(credentials);
  const prefix = `artifacts/${artifactId}/`;

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: credentials.bucket,
      Prefix: prefix,
    })
  );

  const versions = response.Contents
    ?.filter(obj => obj.Key?.endsWith('.tar.gz'))
    ?.map(obj => obj.Key?.replace(prefix, '').replace('.tar.gz', ''))
    ?.filter((v): v is string => Boolean(v))
    ?? [];

  // Sort by semver descending (highest version first)
  return sortVersionsDesc(versions);
}
