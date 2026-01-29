/**
 * Semantic Release Calculator
 *
 * Implementation of VersionCalculator using multi-semantic-release.
 * Runs as subprocess to avoid ESM dynamic import issues in compiled binary.
 *
 * Requires: multi-semantic-release and semantic-release installed in the project.
 */

import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { manifestToPackageJson } from "@grekt-labs/cli-engine";
import type { VersionResult } from "@grekt-labs/cli-engine";
import type { VersionCalculator, CalculateOptions } from "./calculator.types";

const PACKAGE_JSON = "package.json";

// Script that runs multi-semantic-release and outputs JSON results
const RUNNER_SCRIPT = `
import msr from "multi-semantic-release";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const packagePaths = args.filter(a => !a.startsWith("--"));

try {
  const results = await msr(packagePaths, { dryRun });
  console.log("__GREKT_RESULT__" + JSON.stringify({ success: true, results }));
} catch (error) {
  console.log("__GREKT_RESULT__" + JSON.stringify({ success: false, error: error.message }));
}
`;

interface RunnerResult {
  success: boolean;
  results?: Array<{
    name: string;
    result?: {
      lastRelease?: { version: string };
      nextRelease?: { version: string; type: string };
      commits?: Array<{ subject: string }>;
    };
  }>;
  error?: string;
}

function checkDependencies(): void {
  const cwd = process.cwd();
  const nodeModules = join(cwd, "node_modules");

  const msrPath = join(nodeModules, "multi-semantic-release");
  const srPath = join(nodeModules, "semantic-release");

  if (!existsSync(msrPath) || !existsSync(srPath)) {
    const missing: string[] = [];
    if (!existsSync(msrPath)) missing.push("multi-semantic-release");
    if (!existsSync(srPath)) missing.push("semantic-release");

    throw new Error(
      `Automatic versioning requires: ${missing.join(", ")}\n\n` +
      `Install with:\n` +
      `  bun add -D multi-semantic-release semantic-release\n\n` +
      `Or use manual bump:\n` +
      `  grekt version patch|minor|major`
    );
  }
}

export class SemanticReleaseCalculator implements VersionCalculator {
  async calculate(
    artifactPaths: string[],
    manifests: Map<string, { name: string; version: string }>,
    options: CalculateOptions = {}
  ): Promise<VersionResult[]> {
    // Check dependencies first
    checkDependencies();

    const packageJsonPaths: string[] = [];
    const tempScriptPath = join(process.cwd(), ".grekt-version-runner.mjs");

    try {
      // Generate temporary package.json files
      for (const artifactPath of artifactPaths) {
        const manifest = manifests.get(artifactPath);
        if (!manifest) continue;

        const packageJson = manifestToPackageJson({
          name: manifest.name.replace(/^@[^/]+\//, ""),
          author: manifest.name.split("/")[0]?.replace("@", "") || "",
          version: manifest.version,
          description: "",
        });

        const packageJsonPath = join(artifactPath, PACKAGE_JSON);
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        packageJsonPaths.push(packageJsonPath);
      }

      // Write temporary runner script
      writeFileSync(tempScriptPath, RUNNER_SCRIPT);

      // Run via subprocess
      const args = [...packageJsonPaths];
      if (options.dryRun) {
        args.push("--dry-run");
      }

      const result = await runScript(tempScriptPath, args);

      if (!result.success) {
        throw new Error(result.error || "Version calculation failed");
      }

      // Parse results
      const versionResults: VersionResult[] = [];
      for (let i = 0; i < artifactPaths.length; i++) {
        const artifactPath = artifactPaths[i]!;
        const manifest = manifests.get(artifactPath);
        const msrResult = result.results?.[i];

        if (manifest && msrResult?.result) {
          const { lastRelease, nextRelease, commits } = msrResult.result;
          versionResults.push({
            artifactPath,
            artifactName: manifest.name,
            currentVersion: lastRelease?.version || manifest.version,
            newVersion: nextRelease?.version,
            commits: commits?.map(c => c.subject) || [],
          });
        } else if (manifest) {
          versionResults.push({
            artifactPath,
            artifactName: manifest.name,
            currentVersion: manifest.version,
            newVersion: undefined,
            commits: [],
          });
        }
      }

      return versionResults;
    } finally {
      // Cleanup temporary files
      for (const packageJsonPath of packageJsonPaths) {
        if (existsSync(packageJsonPath)) {
          try {
            unlinkSync(packageJsonPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
      if (existsSync(tempScriptPath)) {
        try {
          unlinkSync(tempScriptPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}

function runScript(scriptPath: string, args: string[]): Promise<RunnerResult> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["run", scriptPath, ...args], {
      stdio: ["inherit", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      // Find our marked JSON output
      const marker = "__GREKT_RESULT__";
      const markerIndex = stdout.indexOf(marker);

      if (markerIndex !== -1) {
        const jsonStart = markerIndex + marker.length;
        const jsonStr = stdout.slice(jsonStart).split("\n")[0];
        try {
          resolve(JSON.parse(jsonStr!));
          return;
        } catch {
          // Fall through to error
        }
      }

      resolve({
        success: false,
        error: stderr || stdout || `Process exited with code ${code}`,
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

/**
 * Create the default version calculator.
 */
export function createVersionCalculator(): VersionCalculator {
  return new SemanticReleaseCalculator();
}
