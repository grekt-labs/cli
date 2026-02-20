import type { ValidatedArtifact } from "../validation/validation.types";
import type { Components } from "@grekt-labs/cli-engine";

/**
 * A ValidatedArtifact that has been verified to have a scope (required for publishing).
 */
export type PublishableArtifact = ValidatedArtifact & { scope: string };

export interface ValidateResult {
  artifact: PublishableArtifact;
  components: Components;
}

export interface PrepareResult {
  artifact: PublishableArtifact;
  tarballPath: string;
  tarballFilename: string;
  tarballSize: number;
}
