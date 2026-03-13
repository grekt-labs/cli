import { describe, test, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import {
  createMockInquirer,
  createMockSearchableCheckbox,
  suppressConsole,
} from "#/test-utils";

// Create mocks with access to individual functions
const mockInquirer = createMockInquirer();
vi.mock("@inquirer/prompts", () => mockInquirer);

const mockSearchableCheckboxModule = createMockSearchableCheckbox();
const mockSearchableCheckbox = mockSearchableCheckboxModule.searchableCheckbox;
vi.mock("#/shared/prompts/searchable-checkbox", () => mockSearchableCheckboxModule);

describe("init flow", () => {
  const testDir = join(process.cwd(), ".test-init-flow");
  let restoreConsole: () => void;
  let originalCwd: string;

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    vi.resetModules();
    restoreConsole = suppressConsole("log", "error");
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
    restoreConsole();
    vi.clearAllMocks();
  });

  function setupSelectSequence(...values: unknown[]) {
    for (const value of values) {
      mockInquirer.select.mockResolvedValueOnce(value);
    }
  }

  async function runInit(args: string[] = []) {
    const { initCommand } = await import("./init");
    await initCommand.parseAsync(["node", "init", ...args]);
  }

  function readConfig() {
    return parse(readFileSync(join(testDir, "grekt.yaml"), "utf-8"));
  }

  function readLocalConfig() {
    const path = join(testDir, ".grekt/config.yaml");
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  }

  test("basic flow: select targets, enable remote search, skip registries and dashboard", async () => {
    // Target selection
    mockSearchableCheckbox.mockResolvedValueOnce(["claude"]);
    setupSelectSequence(
      true,   // remote search: Yes
      false,  // host registries: No
      false,  // dashboard: No
      false,  // install @grekt/tools: No
    );

    await runInit();

    const config = readConfig();
    expect(config.targets).toEqual(["claude"]);
    expect(config.remoteSearch).toBe(true);
    expect(existsSync(join(testDir, ".grekt/index"))).toBe(true);
    expect(readLocalConfig()).toBeNull();
  });

  test("basic flow: multiple targets, disable remote search", async () => {
    mockSearchableCheckbox.mockResolvedValueOnce(["claude", "cursor"]);
    setupSelectSequence(
      false,  // remote search: No
      false,  // host registries: No
      false,  // dashboard: No
    );

    await runInit();

    const config = readConfig();
    expect(config.targets).toEqual(["claude", "cursor"]);
    expect(config.remoteSearch).toBe(false);
  });

  test("-y flag: auto-detect and skip all prompts", async () => {
    // Create .claude to trigger detection
    mkdirSync(join(testDir, ".claude"));

    await runInit(["-y"]);

    const config = readConfig();
    expect(config.targets).toContain("claude");
    expect(config.remoteSearch).toBe(true);
    expect(readLocalConfig()).toBeNull();
  });

  test("-y flag: falls back to default target when nothing detected", async () => {
    await runInit(["-y"]);

    const config = readConfig();
    expect(config.targets.length).toBeGreaterThan(0);
    expect(config.remoteSearch).toBe(true);
  });

  test("--targets flag: skips target selection prompt", async () => {
    setupSelectSequence(
      true,   // remote search: Yes
      false,  // host registries: No
      false,  // dashboard: No
      false,  // install @grekt/tools: No
    );

    await runInit(["--targets", "claude,cursor"]);

    const config = readConfig();
    expect(config.targets).toEqual(["claude", "cursor"]);
    // searchableCheckbox should NOT have been called (target prompt skipped)
    expect(mockSearchableCheckbox).not.toHaveBeenCalled();
  });

  test("registry flow: configure a GitLab registry with prefix", async () => {
    const gitlabProvider = { type: "gitlab" as const, label: "GitLab", prompts: vi.fn() };
    gitlabProvider.prompts.mockResolvedValueOnce({
      host: "gitlab.com",
      project: "myteam/artifacts",
      token: "glpat-xxx",
    });

    // Target selection
    mockSearchableCheckbox.mockResolvedValueOnce(["claude"]);

    // select calls in order:
    // 1. remote search confirmSelect → Yes
    // 2. host registries confirmSelect → Yes
    // 3. artifact organization → monorepo
    // 4. provider select → gitlabProvider
    // 5. add another registry confirmSelect → No
    // 6. dashboard confirmSelect → No
    // 7. install @grekt/tools confirmSelect → No
    setupSelectSequence(
      true,            // 1. remote search
      true,            // 2. host registries
      "monorepo",      // 3. artifact organization
      gitlabProvider,  // 4. provider select
      false,           // 5. add another registry
      false,           // 6. dashboard
      false,           // 7. install tools
    );

    // input calls in order:
    // 1. scope
    // 2. prefix
    mockInquirer.input
      .mockResolvedValueOnce("@myteam")
      .mockResolvedValueOnce("team");

    await runInit();

    const localContent = readLocalConfig();
    expect(localContent).not.toBeNull();
    expect(localContent).toContain("@myteam");
    expect(localContent).toContain("gitlab");
    expect(localContent).toContain("prefix: team");
  });

  test("dashboard flow: configure dashboard with URL and token", async () => {
    // Target selection
    mockSearchableCheckbox.mockResolvedValueOnce(["claude"]);

    setupSelectSequence(
      true,   // remote search: Yes
      false,  // host registries: No
      true,   // dashboard: Yes
      true,   // dashboard is running: Yes
    );

    // Dashboard URL input
    mockInquirer.input.mockResolvedValueOnce("https://dashboard.example.com");
    // Dashboard token
    mockInquirer.password.mockResolvedValueOnce("secret-token");

    setupSelectSequence(
      false,  // install @grekt/tools: No
    );

    await runInit();

    const localContent = readLocalConfig();
    expect(localContent).not.toBeNull();
    expect(localContent).toContain("dashboard.example.com");
    expect(localContent).toContain("secret-token");
  });

  test("dashboard flow: skip when not running yet", async () => {
    // Target selection
    mockSearchableCheckbox.mockResolvedValueOnce(["claude"]);

    setupSelectSequence(
      true,   // remote search: Yes
      false,  // host registries: No
      true,   // dashboard: Yes
      false,  // dashboard is running: No
    );

    // "Press enter to continue" input
    mockInquirer.input.mockResolvedValueOnce("");

    setupSelectSequence(
      false,  // install @grekt/tools: No
    );

    await runInit();

    // No local config should be created (no registries, no dashboard)
    expect(readLocalConfig()).toBeNull();
  });

  test("already initialized: shows warning and exits", async () => {
    // First init
    mkdirSync(join(testDir, ".grekt"), { recursive: true });
    const { writeFileSync } = await import("fs");
    writeFileSync(join(testDir, "grekt.yaml"), "targets: [claude]\n");

    await runInit();

    // Should not have called any prompts
    expect(mockSearchableCheckbox).not.toHaveBeenCalled();
    expect(mockInquirer.select).not.toHaveBeenCalled();
  });

  test("gitignore: .grekt is added to existing .gitignore", async () => {
    const { writeFileSync } = await import("fs");
    writeFileSync(join(testDir, ".gitignore"), "node_modules\n");

    mockSearchableCheckbox.mockResolvedValueOnce(["claude"]);
    setupSelectSequence(
      false,  // remote search: No
      false,  // host registries: No
      false,  // dashboard: No
    );

    await runInit();

    const gitignore = readFileSync(join(testDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain(".grekt");
  });

  test("auto-detect: detected tools are pre-checked in selection", async () => {
    // Create tool directories so they're detected
    mkdirSync(join(testDir, ".claude"));
    mkdirSync(join(testDir, ".cursor"));

    mockSearchableCheckbox.mockResolvedValueOnce(["claude", "cursor"]);
    setupSelectSequence(
      true,   // remote search: Yes
      false,  // host registries: No
      false,  // dashboard: No
      false,  // install @grekt/tools: No
    );

    await runInit();

    // Verify searchableCheckbox was called with detected targets pre-checked
    const callArgs = mockSearchableCheckbox.mock.calls[0][0];
    const claudeChoice = callArgs.choices.find((c: { value: string }) => c.value === "claude");
    const cursorChoice = callArgs.choices.find((c: { value: string }) => c.value === "cursor");

    expect(claudeChoice.checked).toBe(true);
    expect(cursorChoice.checked).toBe(true);
  });
});
