import type {
  ValidatedArtifact,
  ValidationError,
  ValidationResult,
} from "#/artifact/validation/validation.types";
import type { TarballResult } from "#/artifact/tarball/tarball";
import type { ArtifactManifest, ArtifactInfo } from "@grekt/engine";

const DEFAULT_MANIFEST: ArtifactManifest = {
  name: "@scope/test",
  version: "1.0.0",
  description: "desc",
  keywords: ["a", "b", "c"],
};

const DEFAULT_SCANNED = {
  manifest: DEFAULT_MANIFEST,
  invalidFiles: [],
  agents: [],
  skills: [],
  commands: [],
  mcps: [],
  rules: [],
  hooks: [],
} as ArtifactInfo;

const DEFAULT_ARTIFACT: ValidatedArtifact = {
  artifactId: "@scope/test",
  scope: "scope",
  fullPath: "/path/to/artifact",
  manifest: DEFAULT_MANIFEST,
  scanned: DEFAULT_SCANNED,
  componentCount: 3,
};

const DEFAULT_TARBALL: TarballResult = {
  success: true,
  path: "/tmp/scope-test-1.0.0.tgz",
  filename: "scope-test-1.0.0.tgz",
  sizeBytes: 5000,
};

export function createValidatedArtifact(
  overrides: Partial<ValidatedArtifact> = {},
): ValidatedArtifact {
  return { ...DEFAULT_ARTIFACT, ...overrides };
}

export function createTarballResult(
  overrides: Partial<TarballResult> = {},
): TarballResult {
  return { ...DEFAULT_TARBALL, ...overrides };
}

export function createValidationError(
  type: ValidationError["type"],
  message = "Validation failed",
  details?: string[],
): ValidationResult {
  return {
    success: false,
    error: { type, message, ...(details ? { details } : {}) },
  };
}

export function createValidationSuccess(
  overrides: Partial<ValidatedArtifact> = {},
): ValidationResult {
  return {
    success: true,
    artifact: createValidatedArtifact(overrides),
  };
}
