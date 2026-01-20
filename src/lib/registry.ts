import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { getConfig } from "#/lib/config";

const DEFAULT_REGISTRY_URL = "https://pub-db2542aa79e24b5f99523d0656d6b343.r2.dev/artifacts";

export function getRegistryUrl(projectRoot: string = process.cwd()): string {
  const config = getConfig(projectRoot);
  return config.registry || DEFAULT_REGISTRY_URL;
}

export async function downloadFromRegistry(
  artifactId: string,
  targetDir: string,
  projectRoot: string = process.cwd()
): Promise<boolean> {
  const registryUrl = getRegistryUrl(projectRoot);
  const tarballUrl = `${registryUrl}/${artifactId}.tar.gz`;

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

export async function artifactExists(
  artifactId: string,
  projectRoot: string = process.cwd()
): Promise<boolean> {
  try {
    const registryUrl = getRegistryUrl(projectRoot);
    const response = await fetch(`${registryUrl}/${artifactId}.tar.gz`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
