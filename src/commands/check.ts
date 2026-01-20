import { Command } from "commander";
import { existsSync } from "fs";
import { basename } from "path";
import { isInitialized } from "#/lib/config";
import { getInstalled } from "#/lib/installed";
import { getLockfile } from "#/lib/lockfile";
import { GREKTS_DIR } from "#/lib/paths";
import { verifyIntegrity, getDirectorySize, formatBytes, estimateTokens } from "#/lib/integrity";
import { success, error, info, log, warning, newline, colors, symbols } from "#/utils/ui";

const CONTEXT_WARNING_THRESHOLD = 10 * 1024; // 10 KB

interface CheckResult {
  artifactId: string;
  status: "ok" | "drift" | "missing" | "not_in_lockfile";
  issues: string[];
}

interface CollisionInfo {
  filename: string;
  type: "skill" | "command";
  artifacts: string[];
}

export const checkCommand = new Command("check")
  .description("Check artifact integrity, sync status, and detect conflicts")
  .action(async () => {
    const projectRoot = process.cwd();

    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    const installed = getInstalled(projectRoot);
    const lockfile = getLockfile(projectRoot);

    const artifactIds = Object.keys(installed.artifacts);

    if (artifactIds.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    log(colors.bold("Checking artifacts...\n"));

    const results: CheckResult[] = [];
    let totalSize = 0;

    // Check each artifact
    for (const artifactId of artifactIds) {
      const artifactDir = `${projectRoot}/${GREKTS_DIR}/${artifactId}`;
      const lockEntry = lockfile.artifacts[artifactId];

      const result: CheckResult = {
        artifactId,
        status: "ok",
        issues: [],
      };

      // Check if directory exists
      if (!existsSync(artifactDir)) {
        result.status = "missing";
        result.issues.push("Directory not found");
        results.push(result);
        continue;
      }

      // Check if in lockfile
      if (!lockEntry) {
        result.status = "not_in_lockfile";
        result.issues.push("Not tracked in grekt.lock");
        results.push(result);
        continue;
      }

      // Verify file integrity
      if (lockEntry.files && Object.keys(lockEntry.files).length > 0) {
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

      // Calculate size
      totalSize += getDirectorySize(artifactDir);

      results.push(result);
    }

    // Display results
    for (const result of results) {
      const version = installed.artifacts[result.artifactId]?.version || "?";

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
      } else if (result.status === "not_in_lockfile") {
        log(`${symbols.warning} ${colors.highlight(result.artifactId)} - ${colors.warning("NOT IN LOCKFILE")}`);
        for (const issue of result.issues) {
          log(`  ${colors.dim("•")} ${issue}`);
        }
      }
    }

    // Check for name overlaps (informational - resolved by namespacing)
    newline();
    log(colors.bold("Checking for name overlaps...\n"));

    const overlaps = detectCollisions(installed);

    if (overlaps.length > 0) {
      info(`${overlaps.length} filename overlap(s) found ${colors.dim("(resolved by namespacing)")}`);
      for (const overlap of overlaps) {
        log(`  ${colors.dim("•")} ${overlap.type}s/${overlap.filename}: ${overlap.artifacts.length} artifacts`);
      }
    } else {
      log(`${symbols.success} No filename overlaps`);
    }

    // Context size summary
    newline();
    log(colors.bold("Context summary:\n"));

    const tokens = estimateTokens(totalSize);
    log(`  Total size: ${formatBytes(totalSize)} (~${tokens.toLocaleString()} tokens)`);

    if (totalSize > CONTEXT_WARNING_THRESHOLD) {
      newline();
      warning("Total context exceeds 10 KB. Consider:");
      log("  • Removing unused artifacts");
      log("  • Using smaller/more focused artifacts");
    }

    // Summary
    newline();
    const okCount = results.filter((r) => r.status === "ok").length;
    const issueCount = results.filter((r) => r.status !== "ok").length;

    if (issueCount === 0) {
      success(`All ${okCount} artifacts are healthy`);
    } else {
      warning(`${issueCount} artifact(s) have issues`);
    }
  });

function detectCollisions(installed: ReturnType<typeof getInstalled>): CollisionInfo[] {
  const skillFiles = new Map<string, string[]>();
  const commandFiles = new Map<string, string[]>();

  for (const [artifactId, artifact] of Object.entries(installed.artifacts)) {
    // Track skill filenames
    for (const skillPath of artifact.skills) {
      const filename = basename(skillPath);
      if (!skillFiles.has(filename)) {
        skillFiles.set(filename, []);
      }
      skillFiles.get(filename)!.push(`${artifactId}/${skillPath}`);
    }

    // Track command filenames
    for (const cmdPath of artifact.commands) {
      const filename = basename(cmdPath);
      if (!commandFiles.has(filename)) {
        commandFiles.set(filename, []);
      }
      commandFiles.get(filename)!.push(`${artifactId}/${cmdPath}`);
    }
  }

  const collisions: CollisionInfo[] = [];

  for (const [filename, artifacts] of skillFiles) {
    if (artifacts.length > 1) {
      collisions.push({ filename, type: "skill", artifacts });
    }
  }

  for (const [filename, artifacts] of commandFiles) {
    if (artifacts.length > 1) {
      collisions.push({ filename, type: "command", artifacts });
    }
  }

  return collisions;
}
