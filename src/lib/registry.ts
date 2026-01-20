import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const REGISTRY_URL = process.env.REGISTRY_URL;

export function getRegistryUrl(): string | undefined {
  return REGISTRY_URL;
}

export function isRegistryConfigured(): boolean {
  return !!REGISTRY_URL;
}

export async function downloadFromRegistry(
  artifactId: string,
  targetDir: string
): Promise<boolean> {
  if (!REGISTRY_URL) {
    throw new Error("REGISTRY_URL not configured");
  }

  const tarballUrl = `${REGISTRY_URL}/${artifactId}.tar.gz`;

  try {
    const response = await fetch(tarballUrl);

    if (!response.ok) {
      return false;
    }

    const buffer = await response.arrayBuffer();
    const tempTarball = `/tmp/grekt-${Date.now()}.tar.gz`;
    writeFileSync(tempTarball, Buffer.from(buffer));

    mkdirSync(targetDir, { recursive: true });
    execSync(`tar -xzf ${tempTarball} -C ${targetDir} --strip-components=1`, {
      stdio: "pipe",
    });
    execSync(`rm -f ${tempTarball}`, { stdio: "pipe" });

    return true;
  } catch {
    return false;
  }
}

export async function artifactExists(artifactId: string): Promise<boolean> {
  if (!REGISTRY_URL) {
    return false;
  }

  try {
    const response = await fetch(`${REGISTRY_URL}/${artifactId}.tar.gz`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
