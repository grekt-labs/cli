import { tmpdir } from "os";
import { join } from "path";
import { fs, shell, http, cryptoProvider } from "#/context";

interface DownloadOptions {
  headers?: Record<string, string>;
  stripComponents?: number;
}

interface TarballDownloadResult {
  success: boolean;
  error?: string;
}

/**
 * Download a tarball from URL and extract to target directory.
 * Handles temp file creation, extraction, and cleanup.
 *
 * @param url - URL to download tarball from
 * @param targetDir - Directory to extract contents to
 * @param options - Optional headers and extraction options
 */
export async function downloadAndExtractTarball(
  url: string,
  targetDir: string,
  options: DownloadOptions = {}
): Promise<TarballDownloadResult> {
  const { headers = {}, stripComponents = 1 } = options;

  // Ensure User-Agent is always set
  const finalHeaders: Record<string, string> = {
    "User-Agent": "grekt-cli",
    ...headers,
  };

  const tempTarball = join(tmpdir(), `grekt-${cryptoProvider.randomUUID()}.tar.gz`);

  try {
    const response = await http.fetch(url, {
      headers: finalHeaders,
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileBinary(tempTarball, Buffer.from(buffer));

    // Ensure target directory exists
    fs.mkdir(targetDir, { recursive: true });

    // Extract tarball
    const tarArgs = ["-xzf", tempTarball, "-C", targetDir];
    if (stripComponents > 0) {
      tarArgs.push(`--strip-components=${stripComponents}`);
    }
    shell.execFile("tar", tarArgs);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    // Always clean up temp file
    if (fs.exists(tempTarball)) {
      fs.unlink(tempTarball);
    }
  }
}
