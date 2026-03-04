/**
 * Promptfoo adapter for the EvalEngine interface.
 *
 * Implements eval execution via promptfoo's Node API.
 * If the Node API is unavailable, falls back to CLI execution.
 * Swap this file for a different engine (braintrust, custom, etc.) without touching anything else.
 */

import type { EvalEngine, EvalRunConfig, EvalRunResult } from "@grekt/engine";
import type { EvalTestCase, EvalTestFailure } from "@grekt/engine";
import { spinner } from "#/shared/ui/ui";

type PromptfooMode = "global" | "npx" | "none";

function detectPromptfoo(): PromptfooMode {
  try {
    const result = Bun.spawnSync(["promptfoo", "--version"], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode === 0) return "global";
  } catch {
    // Not in PATH
  }

  try {
    const result = Bun.spawnSync(["npx", "promptfoo", "--version"], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode === 0) return "npx";
  } catch {
    // npx not available either
  }

  return "none";
}

function getCommand(mode: PromptfooMode): string[] {
  return mode === "npx" ? ["npx", "promptfoo"] : ["promptfoo"];
}

function assemblePromptfooConfig(config: EvalRunConfig): Record<string, unknown> {
  return {
    prompts: [
      {
        raw: JSON.stringify([
          { role: "system", content: config.systemPrompt },
          { role: "user", content: "{{input}}" },
        ]),
      },
    ],
    providers: [config.provider],
    tests: config.tests.map((test: EvalTestCase) => ({
      description: test.description,
      vars: test.vars,
      assert: test.assert.map((a) => ({
        type: a.type,
        ...(a.value !== undefined && { value: a.value }),
        ...(a.threshold !== undefined && { threshold: a.threshold }),
        ...(a.weight !== undefined && { weight: a.weight }),
      })),
    })),
  };
}

function extractFailures(promptfooResults: unknown[]): { passed: number; total: number; failures: EvalTestFailure[] } {
  let passed = 0;
  let total = 0;
  const failures: EvalTestFailure[] = [];

  for (const result of promptfooResults) {
    const r = result as Record<string, unknown>;
    const success = r.success as boolean;
    total++;

    if (success) {
      passed++;
    } else {
      const gradingResult = r.gradingResult as Record<string, unknown> | undefined;
      const componentResults = (gradingResult?.componentResults ?? []) as Array<Record<string, unknown>>;

      for (const component of componentResults) {
        if (!component.pass) {
          const assertion = component.assertion as Record<string, unknown> | undefined;
          failures.push({
            testDescription: (r.description as string) ?? `Test ${total}`,
            assertionType: (assertion?.type as string) ?? "unknown",
            expected: String(assertion?.value ?? ""),
            actual: String(component.reason ?? ""),
          });
        }
      }

      // If no component details, add a generic failure
      if (componentResults.length === 0) {
        failures.push({
          testDescription: (r.description as string) ?? `Test ${total}`,
          assertionType: "unknown",
          expected: "",
          actual: String(gradingResult?.reason ?? "unknown error"),
        });
      }
    }
  }

  return { passed, total, failures };
}

export function createPromptfooEngine(): EvalEngine {
  let mode = detectPromptfoo();

  return {
    name: "promptfoo",

    isAvailable(): boolean {
      return mode !== "none";
    },

    async ensureAvailable(): Promise<boolean> {
      if (mode !== "none") return true;

      const spin = spinner("Downloading promptfoo via npx...");
      spin.start();
      Bun.spawnSync(["npx", "promptfoo@latest", "--version"], { stdout: "pipe", stderr: "pipe" });
      spin.stop();

      mode = detectPromptfoo();
      return mode !== "none";
    },

    async run(config: EvalRunConfig): Promise<EvalRunResult> {
      const promptfooConfig = assemblePromptfooConfig(config);

      // Try Node API first (only available with global install), fall back to CLI
      if (mode === "global") {
        try {
          // @ts-expect-error — promptfoo is an optional peer dependency, not always installed
          const promptfoo = await import("promptfoo") as Record<string, unknown>;
          const evaluate = promptfoo.evaluate as (config: unknown) => Promise<Record<string, unknown>>;
          if (typeof evaluate === "function") {
            const evaluateResult = await evaluate(promptfooConfig);
            const results = (evaluateResult.results ?? []) as unknown[];
            return extractFailures(results);
          }
        } catch {
          // Node API not available, use CLI fallback
        }
      }

      return runViaCli(mode, promptfooConfig);
    },

    openReport(): void {
      const cmd = getCommand(mode);
      Bun.spawnSync([...cmd, "view"], { stdout: "inherit", stderr: "inherit" });
    },
  };
}

async function runViaCli(mode: PromptfooMode, promptfooConfig: Record<string, unknown>): Promise<EvalRunResult> {
  const tempDir = `${process.env.TMPDIR ?? "/tmp"}/grekt-eval-${Date.now()}`;
  const configPath = `${tempDir}/promptfoo-config.json`;
  const outputPath = `${tempDir}/output.json`;

  const { mkdirSync, writeFileSync, readFileSync, rmSync } = await import("fs");
  mkdirSync(tempDir, { recursive: true });

  try {
    writeFileSync(configPath, JSON.stringify(promptfooConfig, null, 2));

    const cmd = getCommand(mode);
    const result = Bun.spawnSync(
      [...cmd, "eval", "--config", configPath, "--output", outputPath, "--no-cache"],
      { stdout: "pipe", stderr: "pipe" }
    );

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString();
      throw new Error(`promptfoo eval failed: ${stderr}`);
    }

    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as Record<string, unknown>;
    const results = (output.results ?? []) as unknown[];
    return extractFailures(results);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
