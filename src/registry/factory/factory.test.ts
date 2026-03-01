import { describe, test, expect } from "vitest";
import { createRegistryClient, resolveRegistry } from "./factory";
import type { LocalConfig } from "#/registry/registry.types";

describe("factory", () => {
  describe("createRegistryClient", () => {
    test("returns default client with download and publish capabilities", () => {
      const registry = {
        type: "default" as const,
        host: "registry.grekt.com",
      };

      const client = createRegistryClient(registry);

      expect(typeof client.download).toBe("function");
      expect(typeof client.publish).toBe("function");
    });

    test("returns gitlab client with download capability", () => {
      const registry = {
        type: "gitlab" as const,
        host: "gitlab.com",
        project: "group/project",
      };

      const client = createRegistryClient(registry);

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
