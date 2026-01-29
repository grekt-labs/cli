import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import { ExitPromptError } from "@inquirer/core";

// Mock ui module
vi.mock("#/shared/ui/ui", () => ({
  newline: vi.fn(),
  info: vi.fn(),
}));

describe("withPromptHandler", () => {
  const originalExit = process.exit;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExit = vi.fn();
    process.exit = mockExit as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.clearAllMocks();
  });

  it("should return the result of the wrapped function", async () => {
    const { withPromptHandler } = await import("./prompts");

    const result = await withPromptHandler(async () => "success");

    expect(result).toBe("success");
  });

  it("should handle ExitPromptError and exit gracefully", async () => {
    const { withPromptHandler } = await import("./prompts");
    const { newline, info } = await import("#/shared/ui/ui");

    const fn = async () => {
      throw new ExitPromptError("User force closed the prompt with SIGINT");
    };

    await withPromptHandler(fn);

    expect(newline).toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("Happy artifacting!");
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("should rethrow non-ExitPromptError errors", async () => {
    const { withPromptHandler } = await import("./prompts");

    const customError = new Error("Something else went wrong");
    const fn = async () => {
      throw customError;
    };

    await expect(withPromptHandler(fn)).rejects.toThrow("Something else went wrong");
  });
});
