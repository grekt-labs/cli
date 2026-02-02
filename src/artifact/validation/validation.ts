import { join, resolve } from "path";
import { parse } from "yaml";
import { isInitialized } from "#/config/project/project";
import { fs } from "#/context";
import { scanArtifact, ArtifactManifestSchema, isValidSemver, CATEGORIES } from "@grekt-labs/cli-engine";
import type { InvalidFile } from "@grekt-labs/cli-engine";
import type {
  ValidatedArtifact,
  ValidationOptions,
  ValidationResult,
} from "./validation.types";

/**
 * Validate that an artifact ID is safe for filesystem operations.
 * Prevents path traversal attacks by rejecting IDs with dangerous patterns.
 * Returns true if safe, false otherwise.
 */
export function isSafeArtifactId(artifactId: string): boolean {
  // Reject path traversal attempts
  if (artifactId.includes("..")) {
    return false;
  }

  // Reject absolute paths
  if (artifactId.startsWith("/") || artifactId.startsWith("\\")) {
    return false;
  }

  // Reject null bytes (can truncate paths in some systems)
  if (artifactId.includes("\0")) {
    return false;
  }

  return true;
}

/**
 * Assert that an artifact ID is safe for filesystem operations.
 * Throws an error if the ID contains dangerous patterns.
 */
export function assertSafeArtifactId(artifactId: string): void {
  if (!isSafeArtifactId(artifactId)) {
    throw new Error(`Invalid artifact ID: "${artifactId}" contains unsafe path characters`);
  }
}

function formatInvalidFileMessage(file: InvalidFile): string {
  const prefix = `  ${file.path}:`;

  // If we have detailed error info, use it
  if (file.details) {
    return `${prefix} ${file.details}`;
  }

  // Fallback to generic messages
  switch (file.reason) {
    case "no-frontmatter":
      return `${prefix} missing frontmatter`;
    case "invalid-frontmatter":
      return `${prefix} invalid frontmatter format`;
    case "missing-type":
      return `${prefix} missing grk-type`;
    case "missing-name":
      return `${prefix} missing grk-name`;
    case "missing-description":
      return `${prefix} missing grk-description`;
    case "invalid-json":
      return `${prefix} invalid JSON`;
    case "invalid-type-for-format":
      return `${prefix} JSON files only support mcp or rule types`;
  }
}

export function validateArtifact(
  artifactPath: string,
  projectRoot: string,
  options: ValidationOptions = {}
): ValidationResult {
  const fullPath = resolve(artifactPath);

  if (!isInitialized(projectRoot)) {
    return {
      success: false,
      error: {
        type: "not-initialized",
        message: "Not in a grekt project. Run 'grekt init' first.",
      },
    };
  }

  if (!fs.exists(fullPath)) {
    return {
      success: false,
      error: {
        type: "not-found",
        message: `Artifact not found: ${fullPath}`,
      },
    };
  }

  const manifestPath = join(fullPath, "grekt.yaml");
  if (!fs.exists(manifestPath)) {
    return {
      success: false,
      error: {
        type: "no-manifest",
        message: `Missing grekt.yaml in ${fullPath}`,
      },
    };
  }

  const rawManifest = parse(fs.readFile(manifestPath));
  const manifestResult = ArtifactManifestSchema.safeParse(rawManifest);

  if (!manifestResult.success) {
    return {
      success: false,
      error: {
        type: "invalid-manifest",
        message: "Invalid grekt.yaml manifest",
        details: manifestResult.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        ),
      },
    };
  }

  const manifest = manifestResult.data;

  if (!isValidSemver(manifest.version)) {
    return {
      success: false,
      error: {
        type: "invalid-version",
        message: `Invalid version: ${manifest.version}`,
        details: ["Version must be valid semver (e.g., 1.0.0, 2.1.0-beta.1)"],
      },
    };
  }

  if (options.requireKeywords) {
    const keywords = manifest.keywords ?? [];
    const { min, max } = options.requireKeywords;

    if (keywords.length < min) {
      return {
        success: false,
        error: {
          type: "keywords",
          message: `Manifest requires at least ${min} keywords`,
          details: [`Add 'keywords' array to grekt.yaml with ${min}-${max} keywords`],
        },
      };
    }

    if (keywords.length > max) {
      return {
        success: false,
        error: {
          type: "keywords",
          message: `Manifest has too many keywords (max ${max})`,
          details: [`Reduce the 'keywords' array to ${min}-${max} keywords`],
        },
      };
    }
  }

  const scanned = scanArtifact(fs, fullPath);
  if (!scanned) {
    return {
      success: false,
      error: {
        type: "no-components",
        message: "Failed to scan artifact",
      },
    };
  }

  const componentCount = CATEGORIES.reduce(
    (count, category) => count + scanned[category].length,
    0
  );

  if (componentCount === 0) {
    const details: string[] = [];

    if (scanned.invalidFiles.length > 0) {
      details.push("Invalid files found:");
      for (const file of scanned.invalidFiles) {
        details.push(formatInvalidFileMessage(file));
      }
    } else {
      details.push("No .md or .json files found in artifact directory");
    }

    return {
      success: false,
      error: {
        type: "no-components",
        message: "Artifact has no valid components",
        details,
      },
    };
  }

  const authorName = manifest.author.startsWith("@") ? manifest.author.slice(1) : manifest.author;
  const artifactId = `@${authorName}/${manifest.name}`;
  const scope = `@${authorName}`;

  return {
    success: true,
    artifact: {
      manifest,
      artifactId,
      scope,
      scanned,
      componentCount,
      fullPath,
    },
  };
}

export { type ValidatedArtifact, type ValidationOptions, type ValidationResult, type ValidationError } from "./validation.types";
