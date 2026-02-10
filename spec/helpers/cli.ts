import { resolve } from "path";

const CLI_ENTRY = resolve(import.meta.dir, "../../src/index.ts");
const DEFAULT_TIMEOUT = 10_000;

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawns the CLI as a subprocess and captures output.
 * Uses `bun run src/index.ts <args>` to run the CLI in a real process.
 */
export async function runCli(
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }
): Promise<CliResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const proc = Bun.spawn(["bun", "run", CLI_ENTRY, ...args], {
    cwd: options?.cwd ?? process.cwd(),
    env: {
      ...process.env,
      // Disable color output for predictable assertions
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      // Disable update check in tests
      GREKT_NO_UPDATE_CHECK: "1",
      ...options?.env,
    },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const timer = setTimeout(() => {
    proc.kill();
  }, timeout);

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  clearTimeout(timer);

  return { exitCode, stdout, stderr };
}
