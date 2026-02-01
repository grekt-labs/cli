import { execFileSync } from "child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join } from "path";
import { parse, stringify } from "yaml";
import type { Components } from "@grekt-labs/cli-engine";

const TARBALL_DIR = ".grekt/tmp";

export interface TarballResult {
  success: boolean;
  path?: string;
  filename?: string;
  error?: string;
}

export interface CreateTarballOptions {
  artifactPath: string;
  artifactId: string;
  projectRoot: string;
  components?: Components; // Auto-generated components to inject into manifest
}

function ensureTarballDir(projectRoot: string): string {
  const tarballDir = join(projectRoot, TARBALL_DIR);
  if (!existsSync(tarballDir)) {
    mkdirSync(tarballDir, { recursive: true });
  }
  return tarballDir;
}

function injectComponentsIntoManifest(
  artifactPath: string,
  components: Components
): void {
  const manifestPath = join(artifactPath, "grekt.yaml");
  const content = readFileSync(manifestPath, "utf-8");
  const manifest = parse(content);

  manifest.components = components;

  writeFileSync(manifestPath, stringify(manifest));
}

export function createTarball(options: CreateTarballOptions): TarballResult {
  const { artifactPath, artifactId, projectRoot, components } = options;

  const tarballDir = ensureTarballDir(projectRoot);
  const tarballName = `${artifactId.replace("/", "-")}.tar.gz`;
  const outputPath = join(tarballDir, tarballName);

  let sourcePath = artifactPath;
  let tempDir: string | null = null;

  try {
    // If components provided, copy to temp and inject into manifest
    if (components) {
      const artifactDirName = basename(artifactPath);
      tempDir = join(tmpdir(), `grekt-tmp-${Date.now()}`);
      const tempArtifactPath = join(tempDir, artifactDirName);

      mkdirSync(tempDir, { recursive: true });
      cpSync(artifactPath, tempArtifactPath, {
        recursive: true,
        filter: (src) => !src.includes("/.grekt/"),
      });
      injectComponentsIntoManifest(tempArtifactPath, components);

      sourcePath = tempArtifactPath;
    }

    const artifactDir = basename(sourcePath);
    const parentDir = dirname(sourcePath);

    execFileSync(
      "tar",
      ["-czf", outputPath, "--exclude=.grekt", "-C", parentDir, artifactDir],
      { stdio: "pipe" }
    );

    return {
      success: true,
      path: outputPath,
      filename: tarballName,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create tarball",
    };
  } finally {
    // Clean up temp directory
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export function removeTarball(tarballPath: string): void {
  try {
    if (existsSync(tarballPath)) {
      rmSync(tarballPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
