/**
 * Semantic Release Calculator
 *
 * Implementation of VersionCalculator using multi-semantic-release.
 * Can be swapped for another implementation without changing command code.
 */

import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import {
  manifestToPackageJson,
  parseMultireleaseResult,
} from "@grekt-labs/cli-engine";
import type { VersionResult } from "@grekt-labs/cli-engine";
import type { VersionCalculator, CalculateOptions } from "./calculator.types";

const PACKAGE_JSON = "package.json";

export class SemanticReleaseCalculator implements VersionCalculator {
  async calculate(
    artifactPaths: string[],
    manifests: Map<string, { name: string; version: string }>,
    options: CalculateOptions = {}
  ): Promise<VersionResult[]> {
    const packageJsonPaths: string[] = [];

    try {
      // Generate temporary package.json files
      for (const artifactPath of artifactPaths) {
        const manifest = manifests.get(artifactPath);
        if (!manifest) continue;

        const packageJson = manifestToPackageJson({
          name: manifest.name.replace(/^@[^/]+\//, ""), // Remove scope for package name
          author: manifest.name.split("/")[0]?.replace("@", "") || "",
          version: manifest.version,
          description: "",
        });

        const packageJsonPath = join(artifactPath, PACKAGE_JSON);
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        packageJsonPaths.push(packageJsonPath);
      }

      // Run multi-semantic-release
      const multirelease = (await import("multi-semantic-release")).default;

      const results = await multirelease(packageJsonPaths, {
        dryRun: options.dryRun,
      });

      // Parse results
      const versionResults: VersionResult[] = [];
      for (let i = 0; i < artifactPaths.length; i++) {
        const artifactPath = artifactPaths[i]!;
        const result = results[i];
        if (result) {
          versionResults.push(parseMultireleaseResult(artifactPath, result));
        }
      }

      return versionResults;
    } finally {
      // Always cleanup temporary package.json files
      for (const packageJsonPath of packageJsonPaths) {
        if (existsSync(packageJsonPath)) {
          try {
            unlinkSync(packageJsonPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
  }
}

/**
 * Create the default version calculator.
 * Easy to swap implementation here.
 */
export function createVersionCalculator(): VersionCalculator {
  return new SemanticReleaseCalculator();
}
