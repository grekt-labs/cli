import { vi } from "vitest";

/**
 * Creates a complete mock of #/shared/ui/ui matching all real exports.
 *
 * Colors return identity functions (passthrough strings).
 * Symbols return plain-text equivalents.
 * Logging functions are vi.fn() no-ops.
 */
export function createMockUI() {
  return {
    colors: {
      success: (s: string) => s,
      error: (s: string) => s,
      warning: (s: string) => s,
      info: (s: string) => s,
      dim: (s: string) => s,
      bold: (s: string) => s,
      highlight: (s: string) => s,
      brand: (s: string) => s,
    },
    symbols: {
      success: "✓",
      error: "✗",
      warning: "⚠",
      info: "i",
      arrow: "→",
      bullet: "•",
    },
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    newline: vi.fn(),
    spinner: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: "",
    })),
  };
}
