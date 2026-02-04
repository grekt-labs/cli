import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import { ExitPromptError } from "@inquirer/core";

// Mock ui module - must include all exports to avoid breaking ui.test.ts
vi.mock("#/shared/ui/ui", () => ({
  newline: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  warn: vi.fn(),
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
}));

// Mock inquirer prompts
const mockCheckbox = vi.fn();
const mockInput = vi.fn();
const mockConfirm = vi.fn();

vi.mock("@inquirer/prompts", () => ({
  checkbox: mockCheckbox,
  input: mockInput,
  confirm: mockConfirm,
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

describe("selectTargetsToAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pluginChoices = [
    { name: "Claude", value: "claude" },
    { name: "Cursor", value: "cursor" },
  ];

  it("should show existing targets as disabled", async () => {
    mockCheckbox.mockResolvedValueOnce(["cursor"]);

    const { selectTargetsToAdd } = await import("./prompts");

    await selectTargetsToAdd(pluginChoices, ["claude"], {});

    const callArgs = mockCheckbox.mock.calls[0][0];
    const claudeChoice = callArgs.choices.find((c: { value: string }) => c.value === "claude");
    const cursorChoice = callArgs.choices.find((c: { value: string }) => c.value === "cursor");

    expect(claudeChoice.disabled).toBe(true);
    expect(claudeChoice.name).toContain("already added");
    expect(cursorChoice.disabled).toBe(false);
  });

  it("should return only newly selected targets", async () => {
    mockCheckbox.mockResolvedValueOnce(["cursor"]);

    const { selectTargetsToAdd } = await import("./prompts");

    const result = await selectTargetsToAdd(pluginChoices, ["claude"], {});

    expect(result.newTargets).toEqual(["cursor"]);
    expect(result.newCustomTargets).toEqual({});
  });

  it("should show existing custom targets as disabled", async () => {
    mockCheckbox.mockResolvedValueOnce([]);

    const { selectTargetsToAdd } = await import("./prompts");

    const customTargets = {
      "my-ai": { name: "My AI", contextEntryPoint: ".my-ai/config.md" },
    };

    await selectTargetsToAdd(pluginChoices, ["my-ai"], customTargets);

    const callArgs = mockCheckbox.mock.calls[0][0];
    const customChoice = callArgs.choices.find((c: { value: string }) => c.value === "my-ai");

    expect(customChoice.disabled).toBe(true);
    expect(customChoice.name).toContain("already added");
  });

  it("should return empty result when no targets selected", async () => {
    mockCheckbox.mockResolvedValueOnce([]);

    const { selectTargetsToAdd } = await import("./prompts");

    const result = await selectTargetsToAdd(pluginChoices, [], {});

    expect(result.newTargets).toEqual([]);
    expect(result.newCustomTargets).toEqual({});
  });
});

describe("selectTargetsToRemove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pluginChoices = [
    { name: "Claude", value: "claude" },
    { name: "Cursor", value: "cursor" },
  ];

  it("should show only currently configured targets", async () => {
    mockCheckbox.mockResolvedValueOnce(["claude"]);

    const { selectTargetsToRemove } = await import("./prompts");

    await selectTargetsToRemove(pluginChoices, ["claude"], {});

    const callArgs = mockCheckbox.mock.calls[0][0];

    expect(callArgs.choices).toHaveLength(1);
    expect(callArgs.choices[0].value).toBe("claude");
  });

  it("should return selected targets to remove", async () => {
    mockCheckbox.mockResolvedValueOnce(["claude", "cursor"]);

    const { selectTargetsToRemove } = await import("./prompts");

    const result = await selectTargetsToRemove(pluginChoices, ["claude", "cursor"], {});

    expect(result).toEqual(["claude", "cursor"]);
  });

  it("should show custom targets with (custom) suffix", async () => {
    mockCheckbox.mockResolvedValueOnce([]);

    const { selectTargetsToRemove } = await import("./prompts");

    const customTargets = {
      "my-ai": { name: "My AI", contextEntryPoint: ".my-ai/config.md" },
    };

    await selectTargetsToRemove(pluginChoices, ["my-ai"], customTargets);

    const callArgs = mockCheckbox.mock.calls[0][0];

    expect(callArgs.choices[0].name).toContain("(custom)");
  });

  it("should return empty array when no targets configured", async () => {
    const { selectTargetsToRemove } = await import("./prompts");

    const result = await selectTargetsToRemove(pluginChoices, [], {});

    expect(result).toEqual([]);
    expect(mockCheckbox).not.toHaveBeenCalled();
  });
});
