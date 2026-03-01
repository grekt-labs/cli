import { vi, type Mock } from "vitest";

export interface MockContextFs {
  exists: Mock<(path: string) => boolean>;
  readFile: Mock<(path: string) => string>;
}

export function createMockContextFs(
  overrides: Partial<{
    exists: (path: string) => boolean;
    readFile: (path: string) => string;
  }> = {},
): MockContextFs {
  return {
    exists: vi.fn(overrides.exists ?? (() => true)),
    readFile: vi.fn(overrides.readFile ?? (() => "")),
  };
}

export interface MockProjectConfig {
  isInitialized: Mock<(root?: string) => boolean>;
}

export function createMockProjectConfig(
  overrides: Partial<{
    isInitialized: (root?: string) => boolean;
  }> = {},
): MockProjectConfig {
  return {
    isInitialized: vi.fn(overrides.isInitialized ?? (() => true)),
  };
}
