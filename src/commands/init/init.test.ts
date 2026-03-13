import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { createMockInquirer, createMockSearchableCheckbox, suppressConsole } from "#/test-utils";

vi.mock("@inquirer/prompts", () => createMockInquirer({ confirm: true }));
vi.mock("#/shared/prompts/searchable-checkbox", () => createMockSearchableCheckbox(["claude"]));

describe("init command", () => {
  const testDir = join(process.cwd(), ".test-init-command");
  let restoreConsole: () => void;
  let originalCwd: string;

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    restoreConsole = suppressConsole("log", "error");
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
    restoreConsole();
    vi.restoreAllMocks();
  });

  describe("createProjectFiles", () => {
    test("creates grekt.yaml with targets and remoteSearch", async () => {
      const { createProjectFiles } = await import("./files");

      createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude", "cursor"],
        customTargets: {},
        remoteSearch: true,
        localConfig: {},
        scopesMissingTokens: [],
      });

      const configPath = join(testDir, "grekt.yaml");
      expect(existsSync(configPath)).toBe(true);

      const config = parse(readFileSync(configPath, "utf-8"));
      expect(config.targets).toEqual(["claude", "cursor"]);
      expect(config.remoteSearch).toBe(true);
    });

    test("creates .grekt directory and index", async () => {
      const { createProjectFiles } = await import("./files");

      createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude"],
        customTargets: {},
        remoteSearch: false,
        localConfig: {},
        scopesMissingTokens: [],
      });

      expect(existsSync(join(testDir, ".grekt"))).toBe(true);
      expect(existsSync(join(testDir, ".grekt/index"))).toBe(true);
      expect(existsSync(join(testDir, ".grekt/artifacts"))).toBe(true);
    });

    test("creates .grekt/config.yaml when registries are configured", async () => {
      const { createProjectFiles } = await import("./files");

      const result = createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude"],
        customTargets: {},
        remoteSearch: true,
        localConfig: {
          registries: {
            "@myteam": {
              type: "gitlab",
              host: "gitlab.com",
              project: "myteam/artifacts",
            },
          },
        },
        scopesMissingTokens: [],
      });

      expect(result.hasLocalConfig).toBe(true);
      const localConfigPath = join(testDir, ".grekt/config.yaml");
      expect(existsSync(localConfigPath)).toBe(true);

      const content = readFileSync(localConfigPath, "utf-8");
      expect(content).toContain("@myteam");
      expect(content).toContain("gitlab");
    });

    test("creates .grekt/config.yaml when dashboard is configured", async () => {
      const { createProjectFiles } = await import("./files");

      const result = createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude"],
        customTargets: {},
        remoteSearch: true,
        localConfig: {
          dashboard: {
            url: "https://dashboard.example.com",
            token: "test-token",
          },
        },
        scopesMissingTokens: [],
      });

      expect(result.hasLocalConfig).toBe(true);
      const content = readFileSync(join(testDir, ".grekt/config.yaml"), "utf-8");
      expect(content).toContain("dashboard.example.com");
    });

    test("does not create config.yaml when no registries or dashboard", async () => {
      const { createProjectFiles } = await import("./files");

      const result = createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude"],
        customTargets: {},
        remoteSearch: true,
        localConfig: {},
        scopesMissingTokens: [],
      });

      expect(result.hasLocalConfig).toBe(false);
      expect(existsSync(join(testDir, ".grekt/config.yaml"))).toBe(false);
    });

    test("saves manifest fields for artifact mode", async () => {
      const { createProjectFiles } = await import("./files");

      createProjectFiles({
        projectRoot: testDir,
        manifestFields: {
          name: "my-artifact",
          author: "grekt",
          version: "1.0.0",
          description: "Test artifact",
          keywords: ["test"],
        },
        detectedTargets: [],
        targets: [],
        customTargets: {},
        remoteSearch: true,
        localConfig: {},
        scopesMissingTokens: [],
      });

      const config = parse(readFileSync(join(testDir, "grekt.yaml"), "utf-8"));
      expect(config.name).toBe("my-artifact");
      expect(config.author).toBe("grekt");
      expect(config.version).toBe("1.0.0");
    });

    test("saves prefix in registry config", async () => {
      const { createProjectFiles } = await import("./files");

      createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude"],
        customTargets: {},
        remoteSearch: true,
        localConfig: {
          registries: {
            "@myteam": {
              type: "gitlab",
              host: "gitlab.com",
              project: "myteam/artifacts",
              prefix: "team",
            },
          },
        },
        scopesMissingTokens: [],
      });

      const content = readFileSync(join(testDir, ".grekt/config.yaml"), "utf-8");
      expect(content).toContain("prefix: team");
    });

    test("adds .grekt to existing .gitignore", async () => {
      writeFileSync(join(testDir, ".gitignore"), "node_modules\n");

      const { createProjectFiles } = await import("./files");

      createProjectFiles({
        projectRoot: testDir,
        manifestFields: {},
        detectedTargets: [],
        targets: ["claude"],
        customTargets: {},
        remoteSearch: true,
        localConfig: {},
        scopesMissingTokens: [],
      });

      const gitignore = readFileSync(join(testDir, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".grekt");
    });
  });

  describe("detectInstalledTargets", () => {
    test("detects claude when .claude directory exists", async () => {
      mkdirSync(join(testDir, ".claude"));

      const { detectInstalledTargets } = await import("#/sync/manager/manager");
      const detected = detectInstalledTargets(testDir);

      expect(detected).toContain("claude");
    });

    test("detects cursor when .cursor directory exists", async () => {
      mkdirSync(join(testDir, ".cursor"));

      const { detectInstalledTargets } = await import("#/sync/manager/manager");
      const detected = detectInstalledTargets(testDir);

      expect(detected).toContain("cursor");
    });

    test("returns empty array when no tools detected", async () => {
      const { detectInstalledTargets } = await import("#/sync/manager/manager");
      const detected = detectInstalledTargets(testDir);

      expect(detected).toEqual([]);
    });

    test("detects multiple tools", async () => {
      mkdirSync(join(testDir, ".claude"));
      mkdirSync(join(testDir, ".cursor"));

      const { detectInstalledTargets } = await import("#/sync/manager/manager");
      const detected = detectInstalledTargets(testDir);

      expect(detected).toContain("claude");
      expect(detected).toContain("cursor");
    });

    test("does not include global plugin", async () => {
      const { detectInstalledTargets } = await import("#/sync/manager/manager");
      const detected = detectInstalledTargets(testDir);

      expect(detected).not.toContain("global");
    });
  });
});
