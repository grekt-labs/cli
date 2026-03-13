import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExitPromptError } from "@inquirer/core";
import { createMockUI, createMockInquirer, createMockSearchableCheckbox } from "#/test-utils";

vi.mock("#/shared/ui/ui", () => createMockUI());

const mockInquirer = createMockInquirer();
vi.mock("@inquirer/prompts", () => mockInquirer);

const mockSearchableCheckboxModule = createMockSearchableCheckbox();
const mockSearchableCheckbox = mockSearchableCheckboxModule.searchableCheckbox;
vi.mock("#/shared/prompts/searchable-checkbox", () => mockSearchableCheckboxModule);

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
    mockSearchableCheckbox.mockResolvedValueOnce(["cursor"]);

    const { selectTargetsToAdd } = await import("./prompts");

    await selectTargetsToAdd(pluginChoices, ["claude"], {});

    const callArgs = mockSearchableCheckbox.mock.calls[0][0];
    const claudeChoice = callArgs.choices.find((c: { value: string }) => c.value === "claude");
    const cursorChoice = callArgs.choices.find((c: { value: string }) => c.value === "cursor");

    expect(claudeChoice.disabled).toBe(true);
    expect(claudeChoice.name).toContain("already added");
    expect(cursorChoice.disabled).toBe(false);
  });

  it("should return only newly selected targets", async () => {
    mockSearchableCheckbox.mockResolvedValueOnce(["cursor"]);

    const { selectTargetsToAdd } = await import("./prompts");

    const result = await selectTargetsToAdd(pluginChoices, ["claude"], {});

    expect(result.newTargets).toEqual(["cursor"]);
    expect(result.newCustomTargets).toEqual({});
  });

  it("should show existing custom targets as disabled", async () => {
    mockSearchableCheckbox.mockResolvedValueOnce([]);

    const { selectTargetsToAdd } = await import("./prompts");

    const customTargets = {
      "my-ai": { name: "My AI", contextEntryPoint: ".my-ai/config.md" },
    };

    await selectTargetsToAdd(pluginChoices, ["my-ai"], customTargets);

    const callArgs = mockSearchableCheckbox.mock.calls[0][0];
    const customChoice = callArgs.choices.find((c: { value: string }) => c.value === "my-ai");

    expect(customChoice.disabled).toBe(true);
    expect(customChoice.name).toContain("already added");
  });

  it("should return empty result when no targets selected", async () => {
    mockSearchableCheckbox.mockResolvedValueOnce([]);

    const { selectTargetsToAdd } = await import("./prompts");

    const result = await selectTargetsToAdd(pluginChoices, [], {});

    expect(result.newTargets).toEqual([]);
    expect(result.newCustomTargets).toEqual({});
  });
});

describe("confirmSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when Yes is selected", async () => {
    mockInquirer.select.mockResolvedValueOnce(true);

    const { confirmSelect } = await import("./prompts");
    const result = await confirmSelect("Continue?");

    expect(result).toBe(true);
  });

  it("should return false when No is selected", async () => {
    mockInquirer.select.mockResolvedValueOnce(false);

    const { confirmSelect } = await import("./prompts");
    const result = await confirmSelect("Continue?");

    expect(result).toBe(false);
  });

  it("should put Yes first when default is true", async () => {
    mockInquirer.select.mockResolvedValueOnce(true);

    const { confirmSelect } = await import("./prompts");
    await confirmSelect("Continue?", true);

    const callArgs = mockInquirer.select.mock.calls[0][0];
    expect(callArgs.choices[0].name).toBe("Yes");
    expect(callArgs.choices[1].name).toBe("No");
  });

  it("should put No first when default is false", async () => {
    mockInquirer.select.mockResolvedValueOnce(false);

    const { confirmSelect } = await import("./prompts");
    await confirmSelect("Continue?", false);

    const callArgs = mockInquirer.select.mock.calls[0][0];
    expect(callArgs.choices[0].name).toBe("No");
    expect(callArgs.choices[1].name).toBe("Yes");
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
    mockSearchableCheckbox.mockResolvedValueOnce(["claude"]);

    const { selectTargetsToRemove } = await import("./prompts");

    await selectTargetsToRemove(pluginChoices, ["claude"], {});

    const callArgs = mockSearchableCheckbox.mock.calls[0][0];

    expect(callArgs.choices).toHaveLength(1);
    expect(callArgs.choices[0].value).toBe("claude");
  });

  it("should return selected targets to remove", async () => {
    mockSearchableCheckbox.mockResolvedValueOnce(["claude", "cursor"]);

    const { selectTargetsToRemove } = await import("./prompts");

    const result = await selectTargetsToRemove(pluginChoices, ["claude", "cursor"], {});

    expect(result).toEqual(["claude", "cursor"]);
  });

  it("should show custom targets with (custom) suffix", async () => {
    mockSearchableCheckbox.mockResolvedValueOnce([]);

    const { selectTargetsToRemove } = await import("./prompts");

    const customTargets = {
      "my-ai": { name: "My AI", contextEntryPoint: ".my-ai/config.md" },
    };

    await selectTargetsToRemove(pluginChoices, ["my-ai"], customTargets);

    const callArgs = mockSearchableCheckbox.mock.calls[0][0];

    expect(callArgs.choices[0].name).toContain("(custom)");
  });

  it("should return empty array when no targets configured", async () => {
    const { selectTargetsToRemove } = await import("./prompts");

    const result = await selectTargetsToRemove(pluginChoices, [], {});

    expect(result).toEqual([]);
    expect(mockSearchableCheckbox).not.toHaveBeenCalled();
  });
});
