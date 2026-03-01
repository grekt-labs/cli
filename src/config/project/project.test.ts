import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { stringify } from "yaml";
import {
  getConfig,
  saveConfig,
  setConfigValue,
  isInitialized,
  getLocalConfig,
  saveLocalConfig,
  getLocalConfigPath,
  getToken,
  setToken,
  removeToken,
  getRegistry,
  setRegistry,
  removeRegistry,
} from "./project";
import type { ProjectConfig, LocalConfig } from "@grekt-labs/cli-engine";

describe("project", () => {
  // Use system temp to avoid finding .grekt/config.yaml in parent directories
  const testDir = join(tmpdir(), ".grekt-test-project");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("getConfig", () => {
    test("returns parsed ProjectConfig", () => {
      const configData = {
        targets: ["claude"],
        artifacts: {
          "@scope/artifact": "1.0.0",
        },
      };
      writeFileSync(join(testDir, "grekt.yaml"), stringify(configData));

      const config = getConfig(testDir);

      expect(config.targets).toEqual(["claude"]);
      expect(config.artifacts["@scope/artifact"]).toBe("1.0.0");
    });

    test("applies defaults for missing fields", () => {
      writeFileSync(join(testDir, "grekt.yaml"), stringify({}));

      const config = getConfig(testDir);

      expect(config.targets).toEqual([]);
      expect(config.artifacts).toEqual({});
    });
  });

  describe("saveConfig", () => {
    test("writes valid YAML", () => {
      const config: ProjectConfig = {
        targets: ["cursor"],
        artifacts: { "@test/pkg": "2.0.0" },
        customTargets: {},
      };

      saveConfig(config, testDir);

      const content = readFileSync(join(testDir, "grekt.yaml"), "utf-8");
      expect(content).toContain("targets:");
      expect(content).toContain("cursor");
    });
  });

  describe("setConfigValue", () => {
    test("updates single key", () => {
      writeFileSync(join(testDir, "grekt.yaml"), stringify({ targets: [] }));

      setConfigValue("targets", ["claude"], testDir);

      const config = getConfig(testDir);
      expect(config.targets).toEqual(["claude"]);
    });
  });

  describe("isInitialized", () => {
    test("returns true when grekt.yaml exists", () => {
      writeFileSync(join(testDir, "grekt.yaml"), stringify({}));

      expect(isInitialized(testDir)).toBe(true);
    });

    test("returns false when grekt.yaml missing", () => {
      expect(isInitialized(testDir)).toBe(false);
    });
  });

  describe("getLocalConfig", () => {
    test("returns null when config.yaml missing", () => {
      const config = getLocalConfig(testDir);

      expect(config).toBeNull();
    });

    test("parses LocalConfig", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      const localConfigData: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
          },
        },
        tokens: {
          github: "gh-token",
        },
      };
      writeFileSync(
        join(testDir, ".grekt", "config.yaml"),
        stringify(localConfigData)
      );

      const config = getLocalConfig(testDir);

      expect(config).not.toBeNull();
      expect(config!.registries!["@myorg"].type).toBe("gitlab");
      expect(config!.tokens!.github).toBe("gh-token");
    });

    test("walks up directory tree to find config", () => {
      // Create parent with config
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      const localConfigData: LocalConfig = {
        registries: {
          "@parent": {
            type: "gitlab",
            project: "parent/artifacts",
          },
        },
      };
      writeFileSync(
        join(testDir, ".grekt", "config.yaml"),
        stringify(localConfigData)
      );

      // Create nested subdirectory
      const nestedDir = join(testDir, "packages", "subpackage");
      mkdirSync(nestedDir, { recursive: true });

      // Should find parent config from nested dir
      const config = getLocalConfig(nestedDir);

      expect(config).not.toBeNull();
      expect(config!.registries!["@parent"].type).toBe("gitlab");
    });
  });

  describe("saveLocalConfig", () => {
    test("writes config file", () => {
      const localConfig: LocalConfig = {
        tokens: { github: "test-token" },
      };

      saveLocalConfig(localConfig, testDir);

      expect(existsSync(join(testDir, ".grekt", "config.yaml"))).toBe(true);
    });
  });

  describe("token management", () => {
    test("getToken returns undefined when not set", () => {
      const token = getToken("github", testDir);

      expect(token).toBeUndefined();
    });

    test("setToken and getToken work together", () => {
      setToken("github", "my-token", testDir);

      const token = getToken("github", testDir);

      expect(token).toBe("my-token");
    });

    test("removeToken removes token without breaking config parsing", () => {
      setToken("github", "my-token", testDir);
      removeToken("github", testDir);

      const token = getToken("github", testDir);
      expect(token).toBeUndefined();
    });

    test("removeToken does nothing when token does not exist", () => {
      expect(() => removeToken("nonexistent", testDir)).not.toThrow();
    });
  });

  describe("registry management", () => {
    test("getRegistry returns undefined when not set", () => {
      const registry = getRegistry("@myorg", testDir);
      expect(registry).toBeUndefined();
    });

    test("setRegistry and getRegistry work together", () => {
      setRegistry("@myorg", { type: "gitlab", project: "myorg/artifacts" }, testDir);

      const registry = getRegistry("@myorg", testDir);
      expect(registry).toBeDefined();
      expect(registry!.type).toBe("gitlab");
      expect(registry!.project).toBe("myorg/artifacts");
    });

    test("setRegistry with host field", () => {
      setRegistry("@corp", { type: "gitlab", project: "corp/pkg", host: "gitlab.corp.com" }, testDir);

      const registry = getRegistry("@corp", testDir);
      expect(registry!.host).toBe("gitlab.corp.com");
    });

    test("removeRegistry removes registry entry", () => {
      setRegistry("@myorg", { type: "gitlab", project: "myorg/artifacts" }, testDir);
      removeRegistry("@myorg", testDir);

      const registry = getRegistry("@myorg", testDir);
      expect(registry).toBeUndefined();
    });

    test("removeRegistry does nothing when registry does not exist", () => {
      expect(() => removeRegistry("@nonexistent", testDir)).not.toThrow();
    });

    test("multiple registries coexist", () => {
      setRegistry("@org1", { type: "gitlab", project: "org1/artifacts" }, testDir);
      setRegistry("@org2", { type: "github", project: "org2/artifacts" }, testDir);

      expect(getRegistry("@org1", testDir)!.type).toBe("gitlab");
      expect(getRegistry("@org2", testDir)!.type).toBe("github");
    });
  });

  describe("getLocalConfig edge cases", () => {
    test("returns empty object for empty config file", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      writeFileSync(join(testDir, ".grekt", "config.yaml"), "");

      const config = getLocalConfig(testDir);
      expect(config).toEqual({});
    });

    test("returns empty object for whitespace-only config file", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      writeFileSync(join(testDir, ".grekt", "config.yaml"), "   \n  \n  ");

      const config = getLocalConfig(testDir);
      expect(config).toEqual({});
    });

    test("returns empty object for malformed YAML", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      writeFileSync(join(testDir, ".grekt", "config.yaml"), "invalid: [yaml: broken");

      const config = getLocalConfig(testDir);
      expect(config).toEqual({});
    });
  });

  describe("getLocalConfigPath", () => {
    test("returns existing config path when found", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      writeFileSync(join(testDir, ".grekt", "config.yaml"), "{}");

      const path = getLocalConfigPath(testDir);
      expect(path).toBe(join(testDir, ".grekt", "config.yaml"));
    });

    test("returns default path when no config exists", () => {
      const path = getLocalConfigPath(testDir);
      expect(path).toContain(".grekt/config.yaml");
    });
  });

  describe("writeLocalConfigWithComments", () => {
    test("generates commented YAML with registries section", () => {
      setRegistry("@myorg", { type: "gitlab", project: "myorg/pkg" }, testDir);

      const content = readFileSync(join(testDir, ".grekt", "config.yaml"), "utf-8");
      expect(content).toContain("# Registry backends");
      expect(content).toContain('"@myorg"');
      expect(content).toContain("type: gitlab");
      expect(content).toContain("project: myorg/pkg");
    });

    test("generates commented YAML with tokens section", () => {
      setToken("github", "ghp_xxx", testDir);

      const content = readFileSync(join(testDir, ".grekt", "config.yaml"), "utf-8");
      expect(content).toContain("# Tokens for git sources");
      expect(content).toContain("github: ghp_xxx");
    });

    test("writes empty object when config has no registries or tokens", () => {
      saveLocalConfig({}, testDir);

      const content = readFileSync(join(testDir, ".grekt", "config.yaml"), "utf-8");
      expect(content.trim()).toBe("{}");
    });
  });
});
