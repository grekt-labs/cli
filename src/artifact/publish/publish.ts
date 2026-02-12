import { setProjectRoot } from "#/auth/session/session";
import { validateArtifact } from "#/artifact/validation/validation";
import { createTarball, removeTarball } from "#/artifact/tarball/tarball";
import { generateComponents } from "@grekt-labs/cli-engine";
import {
  createPublisher,
  getPublisherTypeName,
} from "#/registry/publishers/factory";
import { S3Publisher } from "#/registry/publishers/s3-publisher";
import { CustomPublisher } from "#/registry/publishers/custom-publisher";
import { isApiAuthenticated } from "#/registry/publishers/api-publisher";
import type { PublishContext, Publisher } from "#/registry/publishers/publisher.types";
import { ARTIFACT_MAX_BYTES, ARTIFACT_WARNING_BYTES } from "#/constants";
import { formatBytes } from "#/shared/format";
import type { PrepareResult, ValidateResult } from "./publish.types";

const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 5;

export interface ValidationError {
  message: string;
  type?: string;
  details?: string[];
}

/**
 * Validate an artifact for publishing without creating a tarball.
 * Returns validated artifact info and generated components.
 */
export function validateForPublish(
  artifactPath: string,
  projectRoot: string
): ValidateResult {
  const result = validateArtifact(artifactPath, projectRoot, {
    requireKeywords: { min: MIN_KEYWORDS, max: MAX_KEYWORDS },
  });

  if (!result.success) {
    const validationError: ValidationError = {
      message: result.error.message,
      type: result.error.type,
      details: result.error.details,
    };
    throw Object.assign(new Error(result.error.message), { validationError });
  }

  const { artifact } = result;

  if (!artifact.scope) {
    throw Object.assign(new Error("Cannot publish: artifact name must include scope"), {
      validationError: { message: "Cannot publish: artifact name must include scope", type: "no-scope" } as ValidationError,
    });
  }

  setProjectRoot(projectRoot);

  const components = generateComponents(artifact.scanned);

  return {
    artifact: artifact as ValidateResult["artifact"],
    components,
  };
}

/**
 * Create a tarball from a previously validated artifact.
 * Returns the tarball path, filename, and size.
 */
export function createArtifactTarball(
  validated: ValidateResult,
  projectRoot: string
): { tarballPath: string; tarballFilename: string; tarballSize: number } {
  const { artifact, components } = validated;

  const tarballResult = createTarball({
    artifactPath: artifact.fullPath,
    artifactId: artifact.artifactId,
    projectRoot,
    components,
  });

  if (!tarballResult.success || !tarballResult.path) {
    throw new Error(`Failed to create tarball: ${tarballResult.error}`);
  }

  const tarballSize = tarballResult.sizeBytes ?? 0;

  if (tarballSize > ARTIFACT_MAX_BYTES) {
    removeTarball(tarballResult.path);
    throw Object.assign(new Error("Artifact exceeds size limit"), {
      validationError: {
        message: `Artifact too large: ${formatBytes(tarballSize)} (max: ${formatBytes(ARTIFACT_MAX_BYTES)})`,
        type: "size-limit",
      } as ValidationError,
    });
  }

  return {
    tarballPath: tarballResult.path,
    tarballFilename: tarballResult.filename ?? "",
    tarballSize,
  };
}

/**
 * @deprecated Use validateForPublish() + createArtifactTarball() instead.
 * Validate and prepare an artifact for publishing (legacy combined function).
 */
export function prepareArtifact(
  artifactPath: string,
  projectRoot: string
): PrepareResult {
  const validated = validateForPublish(artifactPath, projectRoot);
  const tarball = createArtifactTarball(validated, projectRoot);

  return {
    artifact: validated.artifact,
    ...tarball,
  };
}

/**
 * Check if tarball size is approaching the limit.
 */
export function isApproachingSizeLimit(tarballSize: number): boolean {
  return tarballSize > ARTIFACT_WARNING_BYTES;
}

/**
 * Create a publisher for the given scope.
 */
export function createArtifactPublisher(options: {
  s3?: boolean;
  scope: string;
  projectRoot: string;
}): Publisher {
  return createPublisher(options);
}

/**
 * Verify publisher authentication and readiness.
 * Returns an error message if not ready, null if ok.
 */
export async function verifyPublisherAuth(
  publisher: Publisher,
  projectRoot: string
): Promise<string | null> {
  if (publisher instanceof S3Publisher && !publisher.hasCredentials()) {
    return "no-s3-credentials";
  }

  if (publisher.type === "api") {
    const authenticated = await isApiAuthenticated();
    if (!authenticated) {
      return "not-authenticated";
    }
  }

  return null;
}

/**
 * Check if a version already exists in the registry.
 */
export async function checkVersionExists(
  publisher: Publisher,
  ctx: PublishContext
): Promise<{ exists: boolean; checkFailed?: boolean; error?: string }> {
  try {
    const exists = await publisher.versionExists(ctx);
    return { exists };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { exists: false, checkFailed: true, error: message };
  }
}

/**
 * Publish the artifact tarball.
 */
export async function publishArtifact(
  publisher: Publisher,
  ctx: PublishContext
): Promise<{ success: boolean; error?: string; url?: string }> {
  return publisher.publish(ctx);
}

export { getPublisherTypeName, removeTarball, ARTIFACT_WARNING_BYTES, formatBytes };
export type { ValidateResult } from "./publish.types";
