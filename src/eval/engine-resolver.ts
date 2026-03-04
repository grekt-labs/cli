/**
 * Engine resolver — detects installed eval engines or prompts user to pick one.
 *
 * Decoupled from any specific engine. Each engine registers itself here.
 * The command only calls resolveEvalEngine() and gets back a ready EvalEngine.
 */

import type { EvalEngine } from "@grekt/engine";
import { select } from "@inquirer/prompts";
import { error, info, log, newline, colors } from "#/shared/ui/ui";
import { createPromptfooEngine } from "#/eval/promptfoo-engine";

interface EngineEntry {
  name: string;
  description: string;
  create: () => EvalEngine;
}

// Register available engines here. When adding a new engine (braintrust, etc.),
// just add an entry — no other file needs to change.
const AVAILABLE_ENGINES: EngineEntry[] = [
  {
    name: "promptfoo",
    description: "Open source LLM eval framework. Runs via npx if not installed",
    create: createPromptfooEngine,
  },
];

/**
 * Resolve an eval engine ready to use.
 *
 * 1. Check if any registered engine is already installed → use it
 * 2. If none found, prompt user to pick one from the list
 * 3. Call ensureAvailable() on the chosen engine (may download via npx, etc.)
 * 4. Return the ready engine, or null if setup failed
 */
export async function resolveEvalEngine(): Promise<EvalEngine | null> {
  // Try to find an already-installed engine
  for (const entry of AVAILABLE_ENGINES) {
    const engine = entry.create();
    if (engine.isAvailable()) return engine;
  }

  // None installed — prompt user to pick one
  newline();
  info("No eval engine detected");
  newline();

  const selected = await select({
    message: "Select an eval engine to use:",
    choices: AVAILABLE_ENGINES.map((entry) => ({
      name: `${entry.name} - ${entry.description}`,
      value: entry.name,
    })),
  });

  const entry = AVAILABLE_ENGINES.find((e) => e.name === selected);
  if (!entry) return null;

  const engine = entry.create();
  const ready = await engine.ensureAvailable();

  if (!ready) {
    newline();
    error(`Failed to set up ${entry.name}`);
    newline();
    log("  Install it manually with one of:");
    log(`    ${colors.dim("$")} npm install -g ${entry.name}`);
    log(`    ${colors.dim("$")} brew install ${entry.name}`);
    return null;
  }

  return engine;
}
