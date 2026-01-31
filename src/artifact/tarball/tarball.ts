import { execFileSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { basename, dirname, join } from "path";

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
}

function ensureTarballDir(projectRoot: string): string {
  const tarballDir = join(projectRoot, TARBALL_DIR);
  if (!existsSync(tarballDir)) {
    mkdirSync(tarballDir, { recursive: true });
  }
  return tarballDir;
}

export function createTarball(options: CreateTarballOptions): TarballResult {
  const { artifactPath, artifactId, projectRoot } = options;

  const tarballDir = ensureTarballDir(projectRoot);
  const tarballName = `${artifactId.replace("/", "-")}.tar.gz`;
  const outputPath = join(tarballDir, tarballName);

  const artifactDir = basename(artifactPath);
  const parentDir = dirname(artifactPath);

  try {
    execFileSync("tar", ["-czf", outputPath, "-C", parentDir, artifactDir], {
      stdio: "pipe",
    });

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
  }
}

export function removeTarball(tarballPath: string): void {
  const { unlinkSync } = require("fs");
  try {
    if (existsSync(tarballPath)) {
      unlinkSync(tarballPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
