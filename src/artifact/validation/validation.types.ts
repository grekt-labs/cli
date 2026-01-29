import type { ArtifactManifest, ArtifactInfo } from "@grekt-labs/cli-engine";

export interface ValidatedArtifact {
  manifest: ArtifactManifest;
  artifactId: string;
  scope: string;
  scanned: ArtifactInfo;
  componentCount: number;
  fullPath: string;
}

export interface ValidationOptions {
  requireKeywords?: {
    min: number;
    max: number;
  };
}

export interface ValidationError {
  type: "not-initialized" | "not-found" | "no-manifest" | "invalid-manifest" | "invalid-version" | "no-components" | "keywords";
  message: string;
  details?: string[];
}

export type ValidationResult =
  | { success: true; artifact: ValidatedArtifact }
  | { success: false; error: ValidationError };
