/**
 * Version calculator types
 *
 * Abstraction layer for semantic versioning calculation.
 * Allows swapping implementations without changing command code.
 */

import type { VersionResult } from "@grekt-labs/cli-engine";

export interface CalculateOptions {
  dryRun?: boolean;
  debug?: boolean;
}

export interface VersionCalculator {
  /**
   * Calculate new versions for artifacts based on conventional commits.
   * Returns results for each artifact path.
   */
  calculate(
    artifactPaths: string[],
    manifests: Map<string, { name: string; version: string }>,
    options?: CalculateOptions
  ): Promise<VersionResult[]>;
}
