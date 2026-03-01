import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { parseSource, getSourceToken } from "./sources";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { stringify } from "yaml";

describe("sources", () => {
  const testDir = "/tmp/grekt-test-sources";

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("parseSource", () => {
    test("detects registry format", () => {
      const result = parseSource("@author/artifact");

      expect(result.type).toBe("registry");
      expect(result.identifier).toBe("@author/artifact");
    });

    test("detects github: format", () => {
      const result = parseSource("github:owner/repo");

      expect(result.type).toBe("github");
      expect(result.identifier).toBe("owner/repo");
    });

    test("detects gitlab: format", () => {
      const result = parseSource("gitlab:owner/repo");

      expect(result.type).toBe("gitlab");
      expect(result.identifier).toBe("owner/repo");
      expect(result.host).toBe("gitlab.com");
    });

    test("extracts ref from #ref", () => {
      const result = parseSource("github:owner/repo#v1.0.0");

      expect(result.type).toBe("github");
      expect(result.identifier).toBe("owner/repo");
      expect(result.ref).toBe("v1.0.0");
    });

    test("detects self-hosted gitlab", () => {
      const result = parseSource("gitlab:gitlab.mycompany.com/team/project");

      expect(result.type).toBe("gitlab");
      expect(result.host).toBe("gitlab.mycompany.com");
      expect(result.identifier).toBe("team/project");
    });

    test("detects local relative path", () => {
      const result = parseSource("./my-skills");

      expect(result.type).toBe("local");
      expect(result.identifier).toBe("./my-skills");
    });

    test("detects local absolute path", () => {
      const result = parseSource("/home/user/skills");

      expect(result.type).toBe("local");
      expect(result.identifier).toBe("/home/user/skills");
    });

    test("detects local home path", () => {
      const result = parseSource("~/my-skills");

      expect(result.type).toBe("local");
      expect(result.identifier).toBe("~/my-skills");
    });
  });

  describe("getSourceToken", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    test("returns github token from config", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      writeFileSync(
        join(testDir, ".grekt/config.yaml"),
        stringify({ tokens: { github: "config-github-token" } })
      );

      const source = parseSource("github:owner/repo");
      const token = getSourceToken(source, testDir);

      expect(token).toBe("config-github-token");
    });

    test("falls back to GITHUB_TOKEN env var", () => {
      process.env.GITHUB_TOKEN = "env-github-token";

      const source = parseSource("github:owner/repo");
      const token = getSourceToken(source, testDir);

      expect(token).toBe("env-github-token");
    });

    test("returns gitlab token from config", () => {
      mkdirSync(join(testDir, ".grekt"), { recursive: true });
      writeFileSync(
        join(testDir, ".grekt/config.yaml"),
        stringify({ tokens: { "gitlab.com": "config-gitlab-token" } })
      );

      const source = parseSource("gitlab:owner/repo");
      const token = getSourceToken(source, testDir);

      expect(token).toBe("config-gitlab-token");
    });

    test("falls back to GITLAB_TOKEN env var", () => {
      process.env.GITLAB_TOKEN = "env-gitlab-token";

      const source = parseSource("gitlab:owner/repo");
      const token = getSourceToken(source, testDir);

      expect(token).toBe("env-gitlab-token");
    });

    test("returns undefined for registry sources", () => {
      const source = parseSource("@author/artifact");
      const token = getSourceToken(source, testDir);

      expect(token).toBeUndefined();
    });

    test("returns undefined for local sources", () => {
      const source = parseSource("./my-skills");
      const token = getSourceToken(source, testDir);

      expect(token).toBeUndefined();
    });
  });
});
