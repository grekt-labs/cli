import { fs, cryptoProvider, scanArtifact, hashDirectory } from "#/context";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { parseSource, downloadFromSource } from "#/registry/sources/sources";
import { parseName, calculateIntegrity } from "@grekt/engine";
import { assertSafeArtifactId } from "#/artifact/validation/validation";
import type { ResolveResult, ResolveOptions } from "./resolver.types";

/**
 * Resolve an artifact from its source string.
 *
 * Downloads to a temp directory, scans the artifact structure,
 * computes integrity hashes, and returns everything needed to
 * build a lockfile entry.
 *
 * The caller is responsible for:
 * - Moving tempDir to the final location
 * - Cleaning up tempDir on failure
 * - Component selection (removeUnselectedFiles)
 */
export async function resolveArtifact(
  sourceStr: string,
  options: ResolveOptions
): Promise<ResolveResult> {
  const { projectRoot, version } = options;

  // For registry sources, append version to source string
  const effectiveSource = version && !sourceStr.includes("@", 1)
    ? `${sourceStr}@${version}`
    : sourceStr;

  const source = parseSource(effectiveSource);

  const tempDir = `${projectRoot}/${ARTIFACTS_DIR}/.tmp-${cryptoProvider.randomUUID()}`;

  try {
    fs.mkdir(tempDir, { recursive: true });
    const downloadResult = await downloadFromSource(source, tempDir, projectRoot);

    if (!downloadResult.success) {
      fs.rmdir(tempDir, { recursive: true });
      return {
        success: false,
        error: downloadResult.error ?? `Failed to download from ${sourceStr}`,
      };
    }

    const artifactInfo = scanArtifact(tempDir);

    if (!artifactInfo) {
      fs.rmdir(tempDir, { recursive: true });
      return {
        success: false,
        error: "Invalid artifact: missing grekt.yaml or invalid structure",
      };
    }

    const resolvedArtifactId = parseName(artifactInfo.manifest.name).artifactId;

    try {
      assertSafeArtifactId(resolvedArtifactId);
    } catch {
      fs.rmdir(tempDir, { recursive: true });
      return {
        success: false,
        error: "Invalid artifact: manifest contains unsafe characters in author or name",
      };
    }

    const fileHashes = hashDirectory(tempDir);
    const integrity = calculateIntegrity(fileHashes);

    // Local sources should not store resolved paths in the lockfile.
    // Absolute paths are machine-specific and break portability (CI/CD, other devs).
    const resolved = source.type === "local" ? undefined : downloadResult.resolved;

    return {
      success: true,
      artifactId: resolvedArtifactId,
      version: artifactInfo.manifest.version,
      lockfileEntry: {
        version: artifactInfo.manifest.version,
        integrity,
        source: source.raw,
        resolved,
        mode: "lazy",
        files: fileHashes,
      },
      tempDir,
    };
  } catch (err) {
    if (fs.exists(tempDir)) {
      fs.rmdir(tempDir, { recursive: true });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
