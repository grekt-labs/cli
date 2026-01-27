import { describe, test, expect } from "bun:test";
import { createRegistryClient, resolveRegistry } from "./factory";
import type { LocalConfig } from "#/registry/registry.types";

describe("factory", () => {
  describe("createRegistryClient", () => {
    test("returns client for default type", () => {
      const registry = {
        type: "default" as const,
        host: "registry.grekt.com",
      };

      const client = createRegistryClient(registry);

      expect(client).toBeDefined();
      expect(typeof client.download).toBe("function");
      expect(typeof client.publish).toBe("function");
    });

    test("returns client for gitlab type", () => {
      const registry = {
        type: "gitlab" as const,
        host: "gitlab.com",
        project: "group/project",
      };

      const client = createRegistryClient(registry);

      expect(client).toBeDefined();
      expect(typeof client.download).toBe("function");
    });

    test("throws for gitlab without project", () => {
      const registry = {
        type: "gitlab" as const,
        host: "gitlab.com",
      };

      expect(() => createRegistryClient(registry)).toThrow();
    });
  });

  describe("resolveRegistry", () => {
    test("resolves from local config", () => {
      const localConfig: LocalConfig = {
        registries: {
          "@myorg": {
            type: "gitlab",
            project: "myorg/artifacts",
          },
        },
      };

      const registry = resolveRegistry("@myorg", localConfig, "/project");

      expect(registry.type).toBe("gitlab");
      expect(registry.project).toBe("myorg/artifacts");
    });

    test("falls back to default when scope not configured", () => {
      const registry = resolveRegistry("@unknown", null, "/project");

      expect(registry.type).toBe("default");
    });
  });
});
