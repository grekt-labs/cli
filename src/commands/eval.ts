import { Command } from "commander";
import { join } from "path";
import { requireInitialized } from "#/shared/guards/guards";
import { getConfig, getLocalConfig } from "#/config/project/project";
import { getLockfile } from "#/context";
import { fs } from "#/context";
import { discoverEvals, summarizeResults } from "@grekt/engine";
import type { DiscoveredEval, EvalFilter } from "@grekt/engine";
import { resolveEvalEngine } from "#/eval/engine-resolver";
import { runAllEvals } from "#/eval/runner";
import { displaySummary, displayDetails, displayJson } from "#/eval/display";
import { error, info, log, warning, newline, spinner, colors } from "#/shared/ui/ui";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { syncToDashboard } from "#/dashboard/dashboard";

interface EvalOptions {
  artifact?: string;
  skill?: string;
  agent?: string;
  command?: string;
  details?: boolean;
  report?: boolean;
  format?: string;
}

function buildFilter(options: EvalOptions): EvalFilter | undefined {
  if (options.skill) return { elementName: options.skill, elementType: "skills" };
  if (options.agent) return { elementName: options.agent, elementType: "agents" };
  if (options.command) return { elementName: options.command, elementType: "commands" };
  return undefined;
}

function requireProvider(projectRoot: string): string {
  const localConfig = getLocalConfig(projectRoot);
  const providers = localConfig?.eval?.providers;
  const firstProvider = providers?.[0];

  if (firstProvider) {
    return firstProvider;
  }

  error("No eval provider configured");
  newline();
  log("  Add a provider to .grekt/config.yaml:");
  newline();
  log(`    ${colors.dim("eval:")}`);
  log(`    ${colors.dim("  providers:")}`);
  log(`    ${colors.dim("    - openai:gpt-4.1-mini")}`);
  newline();
  return process.exit(1);
}

export const evalCommand = new Command("eval")
  .description("Run eval tests against artifact elements (skills, agents, commands)")
  .option("--artifact <name>", "Run evals for a specific artifact only")
  .option("--skill <name>", "Run evals for a specific skill only")
  .option("--agent <name>", "Run evals for a specific agent only")
  .option("--command <name>", "Run evals for a specific command only")
  .option("--details", "Show failure details")
  .option("--report", "Open eval dashboard in browser")
  .option("--format <format>", "Output format: text (default), json")
  .action(async (options: EvalOptions) => {
    const projectRoot = process.cwd();
    requireInitialized(projectRoot);

    const engine = await resolveEvalEngine();
    if (!engine) process.exit(1);

    // Handle --report: just open the dashboard
    if (options.report) {
      engine.openReport?.();
      return;
    }
    const defaultProvider = requireProvider(projectRoot);

    // Discover evals across installed artifacts
    const lockfile = getLockfile(projectRoot);
    const artifactIds = Object.keys(lockfile.artifacts);

    if (artifactIds.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    const filter = buildFilter(options);
    const allDiscovered: DiscoveredEval[] = [];
    const allWarnings: Array<{ evalFilePath: string; message: string }> = [];

    for (const artifactId of artifactIds) {
      if (options.artifact && artifactId !== options.artifact) continue;

      const artifactDir = join(projectRoot, ARTIFACTS_DIR, artifactId);
      const result = discoverEvals(fs, { artifactDir, artifactId, filter });
      allDiscovered.push(...result.evals);
      allWarnings.push(...result.warnings);
    }

    for (const w of allWarnings) {
      warning(w.message);
    }

    if (allDiscovered.length === 0) {
      info("No eval files found");
      if (!filter && !options.artifact) {
        info("Create a .eval.yaml file next to any skill, agent, or command");
      }
      process.exit(0);
    }

    info(`Found ${allDiscovered.length} eval${allDiscovered.length === 1 ? "" : "s"} using ${engine.name}`);

    // Run evals
    const spin = spinner("Running evals...");
    spin.start();

    const results = await runAllEvals(allDiscovered, {
      engine,
      defaultProvider,
      onProgress(completed, total, current) {
        if (current === "done") {
          spin.stop();
        } else {
          spin.text = `Running evals... (${completed + 1}/${total}) ${current}`;
        }
      },
    });

    const summary = summarizeResults(results);

    newline();
    if (options.format === "json") {
      displayJson(summary);
    } else if (options.details) {
      displayDetails(summary);
    } else {
      displaySummary(summary);
    }

    await syncToDashboard(async (reporter) => {
      const projectConfig = getConfig(projectRoot)
      await reporter.reportEval(summary, projectConfig.name ?? "unnamed", "cli")
    })

    if (summary.totalIssues > 0) {
      process.exit(1);
    }
  });
