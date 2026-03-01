import { vi, type Mock } from "vitest";

type ConsoleMethod = "log" | "error" | "warn";

/**
 * Suppresses specified console methods by replacing them with vi.fn().
 * Returns a restore function that puts back the originals.
 */
export function suppressConsole(
  ...methods: ConsoleMethod[]
): () => void {
  const originals = new Map<ConsoleMethod, typeof console.log>();

  for (const method of methods) {
    originals.set(method, console[method]);
    console[method] = vi.fn();
  }

  return () => {
    for (const [method, original] of originals) {
      console[method] = original;
    }
  };
}

/**
 * Spies on console.error (or other method) with mockImplementation(() => {}).
 * Returns the spy for assertions. Caller must call .mockRestore() in afterEach.
 */
export function spyOnConsole(
  method: ConsoleMethod = "error",
): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, method).mockImplementation(() => {});
}

/**
 * Spies on process.exit with a mock that throws to prevent actual exit.
 * Returns the spy for assertions. Caller must call .mockRestore() in afterEach.
 */
export function spyOnProcessExit(): Mock {
  const mockExit = vi.fn();
  process.exit = mockExit as unknown as typeof process.exit;
  return mockExit;
}

/**
 * Spies on process.exit with an implementation that throws (useful for guards).
 * Returns the spy. Caller must restore in afterEach.
 */
export function spyOnProcessExitThrowing(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });
}
