import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { colors } from "#/shared/ui/ui";
import type { UpdateCache } from "./update-check.types";

const CACHE_FILENAME = ".update-check";
const STALENESS_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 1500;
const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/grekt-labs/cli/releases/latest";

function getCachePath(): string {
  return join(homedir(), ".grekt", CACHE_FILENAME);
}

function isOptedOut(): boolean {
  return process.env.GREKT_NO_UPDATE_CHECK === "1";
}

function readCache(): UpdateCache | null {
  try {
    const raw = readFileSync(getCachePath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).latestVersion === "string" &&
      typeof (parsed as Record<string, unknown>).lastChecked === "string"
    ) {
      return parsed as UpdateCache;
    }

    return null;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    const dir = join(homedir(), ".grekt");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(getCachePath(), JSON.stringify(cache));
  } catch {
    // best-effort
  }
}

function isCacheStale(cache: UpdateCache | null): boolean {
  if (!cache) return true;
  const lastChecked = new Date(cache.lastChecked).getTime();
  return Date.now() - lastChecked > STALENESS_MS;
}

async function fetchLatestVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: "application/vnd.github.v3+json" },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { tag_name?: string };
    if (!data.tag_name) return null;

    return data.tag_name.replace(/^v/, "");
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Compares two semver version strings (without 'v' prefix).
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }

  return 0;
}

function printNotice(currentVersion: string, latestVersion: string): void {
  const line = colors.dim("-".repeat(44));

  console.log();
  console.log(`  ${line}`);
  console.log(
    `  ${colors.info("Update available:")} ${colors.dim(currentVersion)} ${colors.dim("→")} ${colors.highlight(latestVersion)}`
  );
  console.log();
  console.log(`  ${colors.dim("curl -fsSL https://cli.grekt.com/install.sh | sh")}`);
  console.log(`  ${colors.dim("brew upgrade grekt")}`);
  console.log(`  ${colors.dim("npm install -g grekt")}`);
  console.log(`  ${line}`);
  console.log();
}

/**
 * Phase 1 (sync): reads the cache and registers an exit handler if a newer version is cached.
 * Must be called before program.parse().
 */
export function setupUpdateCheck(currentVersion: string): void {
  if (isOptedOut()) return;

  const cache = readCache();
  if (!cache) return;

  if (compareVersions(cache.latestVersion, currentVersion) > 0) {
    process.on("exit", () => {
      printNotice(currentVersion, cache.latestVersion);
    });
  }
}

/**
 * Phase 2 (async, fire-and-forget): refreshes the cache if stale.
 * Must be called after program.parseAsync(). Not awaited by the caller.
 */
export async function refreshUpdateCache(): Promise<void> {
  if (isOptedOut()) return;

  const cache = readCache();
  if (!isCacheStale(cache)) return;

  const latestVersion = await fetchLatestVersion();
  if (!latestVersion) return;

  writeCache({
    latestVersion,
    lastChecked: new Date().toISOString(),
  });
}
