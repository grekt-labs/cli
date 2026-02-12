import type { ValidatedArtifact } from "../validation/validation.types";

/**
 * A ValidatedArtifact that has been verified to have a scope (required for publishing).
 */
export type PublishableArtifact = ValidatedArtifact & { scope: string };

export interface ValidateResult {
  artifact: PublishableArtifact;
  components: unknown[];
}

export interface PrepareResult {
  artifact: PublishableArtifact;
  tarballPath: string;
  tarballFilename: string;
  tarballSize: number;
}
