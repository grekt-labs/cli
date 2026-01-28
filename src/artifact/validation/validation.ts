import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { parse } from "yaml";
import { isInitialized } from "#/config/project/project";
import { fs as cliFs } from "#/context";
import { scanArtifact, ArtifactManifestSchema, isValidSemver } from "@grekt-labs/cli-engine";
import type {
  ValidatedArtifact,
  ValidationOptions,
  ValidationResult,
} from "./validation.types";

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

  if (!existsSync(fullPath)) {
    return {
      success: false,
      error: {
        type: "not-found",
        message: `Artifact not found: ${fullPath}`,
      },
    };
  }

  const manifestPath = join(fullPath, "grekt.yaml");
  if (!existsSync(manifestPath)) {
    return {
      success: false,
      error: {
        type: "no-manifest",
        message: `Missing grekt.yaml in ${fullPath}`,
      },
    };
  }

  const rawManifest = parse(readFileSync(manifestPath, "utf-8"));
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

  const scanned = scanArtifact(cliFs, fullPath);
  if (!scanned) {
    return {
      success: false,
      error: {
        type: "no-components",
        message: "Failed to scan artifact",
      },
    };
  }

  const componentCount =
    (scanned.agent ? 1 : 0) +
    scanned.skills.length +
    scanned.commands.length +
    scanned.mcps.length +
    scanned.rules.length;

  if (componentCount === 0) {
    return {
      success: false,
      error: {
        type: "no-components",
        message: "Artifact has no valid components",
        details: [
          "Add at least one agent, skill, command, mcp, or rule file",
          "Files must have valid frontmatter (type, name, description)",
        ],
      },
    };
  }

  const artifactId = `@${manifest.author}/${manifest.name}`;
  const scope = `@${manifest.author}`;

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
