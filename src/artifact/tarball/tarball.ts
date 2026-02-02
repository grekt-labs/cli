import { tmpdir } from "os";
import { basename, dirname, join } from "path";
import { parse, stringify } from "yaml";
import { fs, shell } from "#/context";
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
  if (!fs.exists(tarballDir)) {
    fs.mkdir(tarballDir, { recursive: true });
  }
  return tarballDir;
}

function injectComponentsIntoManifest(
  artifactPath: string,
  components: Components
): void {
  const manifestPath = join(artifactPath, "grekt.yaml");
  const content = fs.readFile(manifestPath);
  const manifest = parse(content);

  manifest.components = components;

  fs.writeFile(manifestPath, stringify(manifest));
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

      fs.mkdir(tempDir, { recursive: true });
      fs.copy(artifactPath, tempArtifactPath, {
        recursive: true,
        filter: (src) => !src.includes("/.grekt/"),
      });
      injectComponentsIntoManifest(tempArtifactPath, components);

      sourcePath = tempArtifactPath;
    }

    const artifactDir = basename(sourcePath);
    const parentDir = dirname(sourcePath);

    shell.execFile("tar", ["-czf", outputPath, "--exclude=.grekt", "-C", parentDir, artifactDir]);

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
    if (tempDir && fs.exists(tempDir)) {
      fs.rmdir(tempDir, { recursive: true });
    }
  }
}

export function removeTarball(tarballPath: string): void {
  try {
    if (fs.exists(tarballPath)) {
      fs.unlink(tarballPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
