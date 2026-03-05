import { vi, type Mock } from "vitest";

export interface MockSpawn {
  spawn: Mock;
  unref: Mock;
  on: Mock;
  reset: () => void;
}

/**
 * Creates a mock for child_process.spawn that returns a process with .unref() and .on().
 * Use with vi.mock("child_process", ...) to replace spawn.
 */
export function createMockSpawn(): MockSpawn {
  const unref = vi.fn();
  const on = vi.fn();
  const spawn = vi.fn(() => ({ unref, on }));

  return {
    spawn,
    unref,
    on,
    reset: () => {
      spawn.mockClear();
      unref.mockClear();
      on.mockClear();
      spawn.mockImplementation(() => ({ unref, on }));
    },
  };
}
