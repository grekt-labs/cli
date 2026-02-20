import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { parseArtifactId, resolveRegistry, resolveRegistryForArtifact } from "./resolver";
import { parseArtifactId as engineParseArtifactId } from "@grekt-labs/cli-engine";
import type { LocalConfig } from "#/registry/registry.types";

describe("resolver", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("parseArtifactId", () => {
    test("parses @scope/name format", () => {
      const result = parseArtifactId("@myorg/my-artifact");

      expect(result.scope).toBe("@myorg");
      expect(result.name).toBe("my-artifact");
      expect(result.artifactId).toBe("@myorg/my-artifact");
      expect(result.version).toBeUndefined();
    });

    test("parses @scope/name@version format", () => {
      const result = parseArtifactId("@scope/artifact@1.0.0");

      expect(result.scope).toBe("@scope");
      expect(result.name).toBe("artifact");
      expect(result.artifactId).toBe("@scope/artifact");
      expect(result.version).toBe("1.0.0");
    });

    test("handles complex version strings", () => {
      const result = parseArtifactId("@scope/pkg@2.0.0-beta.1");

      expect(result.version).toBe("2.0.0-beta.1");
    });

    test("throws on invalid format", () => {
      expect(() => parseArtifactId("invalid")).toThrow("Invalid artifact ID");
      expect(() => parseArtifactId("no-scope")).toThrow("Invalid artifact ID");
    });

    test("re-export matches cli-engine implementation", () => {
      expect(parseArtifactId).toBe(engineParseArtifactId);
    });
  });

  describe("resolveRegistry", () => {
    test("returns config for scope when present", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
            host: "gitlab.myorg.com",
          },
        },
      };

      const result = resolveRegistry("@myorg", localConfig);

      expect(result.type).toBe("gitlab");
      expect(result.project).toBe("myorg/artifacts");
      expect(result.host).toBe("gitlab.myorg.com");
    });

    test("falls back to default registry when scope not found", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@other": {
            type: "gitlab",
            project: "other/artifacts",
          },
        },
      };

      const result = resolveRegistry("@unknown", localConfig);

      expect(result.type).toBe("default");
      expect(result.host).toBe("registry.grekt.com");
    });

    test("falls back to default registry when no config", () => {
      const result = resolveRegistry("@scope", null);

      expect(result.type).toBe("default");
      expect(result.host).toBe("registry.grekt.com");
    });

    test("uses token from config", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
            token: "config-token",
          },
        },
      };

      const result = resolveRegistry("@myorg", localConfig);

      expect(result.token).toBe("config-token");
    });

    test("resolves GITLAB_TOKEN from env for gitlab type", () => {
      process.env.GITLAB_TOKEN = "env-gitlab-token";
      delete process.env.GL_TOKEN;

      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
          },
        },
      };

      const result = resolveRegistry("@myorg", localConfig);

      expect(result.token).toBe("env-gitlab-token");
    });

    test("resolves GITHUB_TOKEN from env for github type", () => {
      process.env.GITHUB_TOKEN = "env-github-token";
      delete process.env.GH_TOKEN;

      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "github",
            project: "myorg/artifacts",
          },
        },
      };

      const result = resolveRegistry("@myorg", localConfig);

      expect(result.token).toBe("env-github-token");
    });

    test("includes prefix when configured", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
            prefix: "frontend",
          },
        },
      };

      const result = resolveRegistry("@myorg", localConfig);

      expect(result.prefix).toBe("frontend");
    });

    test("prefix is undefined when not configured", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
          },
        },
      };

      const result = resolveRegistry("@myorg", localConfig);

      expect(result.prefix).toBeUndefined();
    });
  });

  describe("resolveRegistryForArtifact", () => {
    test("parses artifact and resolves registry", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
          },
        },
      };

      const result = resolveRegistryForArtifact("@myorg/tool@1.0.0", localConfig);

      expect(result.artifactId).toBe("@myorg/tool");
      expect(result.version).toBe("1.0.0");
      expect(result.registry.type).toBe("gitlab");
    });
  });
});
