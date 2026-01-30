import { existsSync, readFileSync } from "fs";
import { basename, join } from "path";
import { getLockfile, getSafeFilename } from "#/context";
import { getConfig } from "#/config/project/project";
import { getSyncPaths } from "#/sync/manager/manager";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { verifyIntegrity, getDirectorySize, formatBytes, estimateTokens } from "#/context";
import { success, warning, log, newline, colors, symbols } from "#/shared/ui/ui";
import {
  type Lockfile,
  type ProjectConfig,
  type ArtifactMode,
  CATEGORIES,
  isUniqueCategory,
  type Category,
} from "@grekt-labs/cli-engine";

const CONTEXT_WARNING_THRESHOLD = 10 * 1024; // 10 KB

function getArtifactMode(config: ProjectConfig, artifactId: string): ArtifactMode {
  const entry = config.artifacts[artifactId];
  if (!entry) return "lazy";
  if (typeof entry === "string") return "lazy";
  return entry.mode ?? "lazy";
}

function filesAreEqual(path1: string, path2: string): boolean {
  if (!existsSync(path1) || !existsSync(path2)) return false;
  const content1 = readFileSync(path1);
  const content2 = readFileSync(path2);
  return content1.equals(content2);
}

export interface CheckResult {
  artifactId: string;
  status: "ok" | "drift" | "missing";
  issues: string[];
}

interface CollisionInfo {
  filename: string;
  category: Category;
  artifacts: string[];
}

export interface CheckSummary {
  results: CheckResult[];
  totalSize: number;
  okCount: number;
  driftCount: number;
  missingCount: number;
  collisions: CollisionInfo[];
  healthy: boolean;
}

function detectCollisions(lockfile: Lockfile): CollisionInfo[] {
  const collisions: CollisionInfo[] = [];

  // Check for filename collisions in non-unique categories
  for (const category of CATEGORIES) {
    if (isUniqueCategory(category)) continue;

    const fileMap = new Map<string, string[]>();

    for (const [artifactId, artifact] of Object.entries(lockfile.artifacts)) {
      for (const filePath of artifact[category]) {
        const filename = basename(filePath);
        if (!fileMap.has(filename)) {
          fileMap.set(filename, []);
        }
        fileMap.get(filename)!.push(`${artifactId}/${filePath}`);
      }
    }

    for (const [filename, artifacts] of fileMap) {
      if (artifacts.length > 1) {
        collisions.push({ filename, category, artifacts });
      }
    }
  }

  return collisions;
}

/**
 * Run integrity check on all installed artifacts
 */
export function runCheck(projectRoot: string): CheckSummary {
  const lockfile = getLockfile(projectRoot);
  const config = getConfig(projectRoot);
  const artifactIds = Object.keys(lockfile.artifacts);

  const results: CheckResult[] = [];
  let totalSize = 0;

  for (const artifactId of artifactIds) {
    const artifactDir = `${projectRoot}/${ARTIFACTS_DIR}/${artifactId}`;
    const lockEntry = lockfile.artifacts[artifactId];

    const result: CheckResult = {
      artifactId,
      status: "ok",
      issues: [],
    };

    if (!existsSync(artifactDir)) {
      result.status = "missing";
      result.issues.push("Directory not found");
      results.push(result);
      continue;
    }

    if (lockEntry?.files && Object.keys(lockEntry.files).length > 0) {
      const integrity = verifyIntegrity(artifactDir, lockEntry.files);

      if (!integrity.valid) {
        result.status = "drift";

        for (const file of integrity.missingFiles) {
          result.issues.push(`Missing: ${file}`);
        }

        for (const mod of integrity.modifiedFiles) {
          result.issues.push(`Modified: ${mod.path}`);
        }
      }
    }

    // Check synced files for CORE mode artifacts
    const mode = getArtifactMode(config, artifactId);
    if (mode === "core" && lockEntry && config.targets.length > 0) {
      for (const target of config.targets) {
        const syncPaths = getSyncPaths(target, config.customTargets);
        if (!syncPaths) continue;

        const checkSyncedFile = (sourcePath: string, targetDir: string, targetName: string): void => {
          const targetPath = `${projectRoot}/${targetDir}/${targetName}`;
          if (existsSync(targetPath)) {
            if (!filesAreEqual(sourcePath, targetPath)) {
              result.status = "drift";
              result.issues.push(`Synced modified (${target}): ${targetDir}/${targetName}`);
            }
          } else {
            result.status = "drift";
            result.issues.push(`Synced missing (${target}): ${targetDir}/${targetName}`);
          }
        };

        for (const category of CATEGORIES) {
          const targetDir = syncPaths[category];
          if (!targetDir) continue;

          const items = lockEntry[category];
          if (!items || items.length === 0) continue;

          for (const filePath of items) {
            const targetName = isUniqueCategory(category)
              ? `${artifactId.replace("/", "-")}.md`
              : getSafeFilename(artifactId, filePath);

            checkSyncedFile(join(artifactDir, filePath), targetDir, targetName);
          }
        }
      }
    }

    totalSize += getDirectorySize(artifactDir);
    results.push(result);
  }

  const collisions = detectCollisions(lockfile);
  const okCount = results.filter((r) => r.status === "ok").length;
  const driftCount = results.filter((r) => r.status === "drift").length;
  const missingCount = results.filter((r) => r.status === "missing").length;

  return {
    results,
    totalSize,
    okCount,
    driftCount,
    missingCount,
    collisions,
    healthy: driftCount === 0 && missingCount === 0,
  };
}

/**
 * Display check results (verbose output for standalone check command)
 */
export function displayCheckResults(summary: CheckSummary, lockfile: Lockfile): void {
  log(colors.bold("Checking artifacts...\n"));

  for (const result of summary.results) {
    const version = lockfile.artifacts[result.artifactId]?.version || "?";

    if (result.status === "ok") {
      log(`${symbols.success} ${colors.highlight(result.artifactId)} ${colors.dim(`v${version}`)} - OK`);
    } else if (result.status === "drift") {
      log(`${symbols.warning} ${colors.highlight(result.artifactId)} ${colors.dim(`v${version}`)} - ${colors.warning("DRIFT DETECTED")}`);
      for (const issue of result.issues) {
        log(`  ${colors.dim("•")} ${issue}`);
      }
    } else if (result.status === "missing") {
      log(`${symbols.error} ${colors.highlight(result.artifactId)} - ${colors.error("MISSING FILES")}`);
      for (const issue of result.issues) {
        log(`  ${colors.dim("•")} ${issue}`);
      }
    }
  }

  newline();
  log(colors.bold("Checking for name overlaps...\n"));

  if (summary.collisions.length > 0) {
    log(`${summary.collisions.length} filename overlap(s) found ${colors.dim("(resolved by namespacing)")}`);
    for (const overlap of summary.collisions) {
      log(`  ${colors.dim("•")} ${overlap.category}/${overlap.filename}: ${overlap.artifacts.length} artifacts`);
    }
  } else {
    log(`${symbols.success} No filename overlaps`);
  }

  newline();
  log(colors.bold("Context summary:\n"));

  const tokens = estimateTokens(summary.totalSize);
  log(`  Total size: ${formatBytes(summary.totalSize)} (~${tokens.toLocaleString()} tokens)`);

  if (summary.totalSize > CONTEXT_WARNING_THRESHOLD) {
    newline();
    warning("Total context exceeds 10 KB. Consider:");
    log("  • Removing unused artifacts");
    log("  • Using smaller/more focused artifacts");
  }

  newline();

  if (summary.healthy) {
    success(`All ${summary.okCount} artifact(s) are healthy`);
  } else {
    warning(`${summary.driftCount + summary.missingCount} artifact(s) have issues`);
  }
}

/**
 * Display compact check results (for autoCheck after add/install)
 */
export function displayCompactCheckResults(summary: CheckSummary): void {
  newline();
  log(colors.bold("Integrity check:"));

  if (summary.healthy) {
    success(`All ${summary.okCount} artifact(s) verified`);
  } else {
    warning(`${summary.driftCount + summary.missingCount} artifact(s) have issues`);

    for (const result of summary.results) {
      if (result.status !== "ok") {
        log(`  ${symbols.warning} ${result.artifactId}: ${result.status}`);
      }
    }
  }
}
