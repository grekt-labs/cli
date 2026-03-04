/**
 * Eval runner — orchestrates eval execution through the engine interface.
 * Engine-agnostic: works with promptfoo, braintrust, or any EvalEngine.
 */

import type { EvalEngine, DiscoveredEval, EvalElementResult } from "@grekt/engine";
import { calculateScore, scoreToGrade } from "@grekt/engine";

export type ProgressCallback = (completed: number, total: number, current: string) => void;

export interface RunEvalOptions {
  engine: EvalEngine;
  defaultProvider: string;
}

export async function runEval(
  discovered: DiscoveredEval,
  options: RunEvalOptions,
): Promise<EvalElementResult> {
  const provider = discovered.evalConfig.provider ?? options.defaultProvider;

  const result = await options.engine.run({
    systemPrompt: discovered.systemPrompt,
    tests: discovered.evalConfig.tests,
    provider,
  });

  const score = calculateScore(result.passed, result.total);
  const grade = scoreToGrade(score);

  return {
    artifactId: discovered.artifactId,
    elementName: discovered.elementName,
    elementType: discovered.elementType,
    passed: result.passed,
    total: result.total,
    score,
    grade,
    failures: result.failures,
  };
}

export interface RunAllEvalsOptions extends RunEvalOptions {
  onProgress?: ProgressCallback;
}

export async function runAllEvals(
  discovered: DiscoveredEval[],
  options: RunAllEvalsOptions,
): Promise<EvalElementResult[]> {
  const results: EvalElementResult[] = [];

  for (const [index, disc] of discovered.entries()) {
    options.onProgress?.(index, discovered.length, `${disc.elementType}/${disc.elementName}`);

    const result = await runEval(disc, options);
    results.push(result);
  }

  options.onProgress?.(discovered.length, discovered.length, "done");
  return results;
}
