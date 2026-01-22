import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { getConfig } from "#/lib/config";
import type { ArtifactMetadata } from "#/schemas/index";

const DEFAULT_REGISTRY_URL = "https://pub-db2542aa79e24b5f99523d0656d6b343.r2.dev/artifacts";

export function getRegistryUrl(projectRoot: string = process.cwd()): string {
  const config = getConfig(projectRoot);
  return config.registry || DEFAULT_REGISTRY_URL;
}

export interface DownloadResult {
  success: boolean;
  version?: string;
  deprecationMessage?: string;
}

export async function fetchRegistryMetadata(
  artifactId: string,
  projectRoot: string = process.cwd()
): Promise<ArtifactMetadata | null> {
  const registryUrl = getRegistryUrl(projectRoot);
  const metadataUrl = `${registryUrl}/${artifactId}/metadata.json`;

  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function parseArtifactWithVersion(source: string): { artifactId: string; version?: string } {
  const match = source.match(/^(@[^@]+)(?:@(.+))?$/);
  if (match) {
    return { artifactId: match[1], version: match[2] };
  }
  return { artifactId: source };
}

export async function downloadFromRegistry(
  artifactSource: string,
  targetDir: string,
  projectRoot: string = process.cwd()
): Promise<DownloadResult> {
  const registryUrl = getRegistryUrl(projectRoot);
  const { artifactId, version: requestedVersion } = parseArtifactWithVersion(artifactSource);

  const metadata = await fetchRegistryMetadata(artifactId, projectRoot);
  if (!metadata) {
    return { success: false };
  }

  const version = requestedVersion || metadata.latest;
  const tarballUrl = `${registryUrl}/${artifactId}/${version}.tar.gz`;
  const deprecationMessage = metadata.deprecated[version];

  try {
    const response = await fetch(tarballUrl);
    if (!response.ok) {
      return { success: false };
    }

    const buffer = await response.arrayBuffer();
    const tempTarball = `/tmp/grekt-${Date.now()}.tar.gz`;
    writeFileSync(tempTarball, Buffer.from(buffer));

    mkdirSync(targetDir, { recursive: true });
    execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
      stdio: "pipe",
    });
    execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

    return { success: true, version, deprecationMessage };
  } catch {
    return { success: false };
  }
}

export async function artifactExists(
  artifactId: string,
  projectRoot: string = process.cwd()
): Promise<boolean> {
  const metadata = await fetchRegistryMetadata(artifactId, projectRoot);
  return metadata !== null;
}
