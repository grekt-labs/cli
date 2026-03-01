import { vi, type Mock } from "vitest";

export interface MockSpawn {
  spawn: Mock;
  unref: Mock;
  reset: () => void;
}

/**
 * Creates a mock for child_process.spawn that returns a process with .unref().
 * Use with vi.mock("child_process", ...) to replace spawn.
 */
export function createMockSpawn(): MockSpawn {
  const unref = vi.fn();
  const spawn = vi.fn(() => ({ unref }));

  return {
    spawn,
    unref,
    reset: () => {
      spawn.mockClear();
      unref.mockClear();
      spawn.mockImplementation(() => ({ unref }));
    },
  };
}
