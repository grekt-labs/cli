import { resolve, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";

const FIXTURES_DIR = resolve(import.meta.dir, "..", "fixtures", "artifacts");
const TARBALL_CACHE_DIR = resolve(import.meta.dir, "..", ".tarball-cache");

/**
 * Returns the absolute path to a fixture artifact directory.
 */
export function getFixturePath(name: string): string {
  return join(FIXTURES_DIR, name);
}

/**
 * Creates a tarball (.tar.gz) from a fixture directory.
 * Caches the result so it's only built once per test run.
 * Returns the absolute path to the tarball.
 */
export function buildFixtureTarball(name: string): string {
  if (!existsSync(TARBALL_CACHE_DIR)) {
    mkdirSync(TARBALL_CACHE_DIR, { recursive: true });
  }

  const tarballPath = join(TARBALL_CACHE_DIR, `${name}.tar.gz`);

  if (existsSync(tarballPath)) {
    return tarballPath;
  }

  const fixturePath = getFixturePath(name);
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }

  // Create tarball with a top-level directory (strip-components=1 on extraction)
  execSync(`tar -czf "${tarballPath}" -C "${fixturePath}" .`, { stdio: "pipe" });

  return tarballPath;
}

/**
 * Cleans up the tarball cache directory.
 */
export function cleanTarballCache(): void {
  if (existsSync(TARBALL_CACHE_DIR)) {
    execSync(`rm -rf "${TARBALL_CACHE_DIR}"`, { stdio: "pipe" });
  }
}
