import { describe, test, expect, mock, beforeEach } from "bun:test";
import { RegistryApiError } from "@grekt-labs/cli-engine";

const mockIsAuthenticated = mock(() => Promise.resolve(false));
const mockIsSupabaseConfigured = mock(() => true);

mock.module("#/auth/session/session", () => ({
  isAuthenticated: mockIsAuthenticated,
  isSupabaseConfigured: mockIsSupabaseConfigured,
}));

const mockFetch = mock();
mock.module("#/context", () => ({
  fs: {
    readFileBinary: () => Buffer.from("fake-tarball"),
  },
  http: {
    fetch: mockFetch,
  },
}));

const mockResolveRegistry = mock(() => ({
  type: "default" as const,
  host: "registry.grekt.com",
  token: "test-token",
}));

const mockCreateRegistryClient = mock();

mock.module("#/registry/factory/factory", () => ({
  resolveRegistry: mockResolveRegistry,
  createRegistryClient: mockCreateRegistryClient,
}));

mock.module("#/config/project/project", () => ({
  getLocalConfig: () => null,
}));

import { ApiPublisher, isApiAuthenticated } from "./api-publisher";
import type { PublishContext } from "./publisher.types";

function createContext(overrides: Partial<PublishContext> = {}): PublishContext {
  return {
    artifactId: "@scope/artifact",
    version: "1.0.0",
    tarballPath: "/tmp/artifact.tar.gz",
    scope: "@scope",
    projectRoot: "/project",
    categories: ["agents"],
    description: "Test artifact",
    keywords: ["test", "demo", "example"],
    ...overrides,
  };
}

describe("ApiPublisher", () => {
  const publisher = new ApiPublisher();

  beforeEach(() => {
    mockIsAuthenticated.mockClear();
    mockFetch.mockClear();
    mockResolveRegistry.mockClear();
    mockCreateRegistryClient.mockClear();
  });

  test("type is 'api'", () => {
    expect(publisher.type).toBe("api");
  });

  describe("versionExists", () => {
    test("returns false when not authenticated", async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const result = await publisher.versionExists(createContext());

      expect(result).toBe(false);
    });

    test("returns result from registry client", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        versionExists: mock(() => Promise.resolve(true)),
      });

      const result = await publisher.versionExists(createContext());

      expect(result).toBe(true);
    });

    test("returns false on client error", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        versionExists: mock(() => Promise.reject(new Error("network error"))),
      });

      const result = await publisher.versionExists(createContext());

      expect(result).toBe(false);
    });
  });

  describe("getLatestVersion", () => {
    test("returns null when not authenticated", async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const result = await publisher.getLatestVersion(createContext());

      expect(result).toBeNull();
    });

    test("returns version from registry client", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        getLatestVersion: mock(() => Promise.resolve("2.0.0")),
      });

      const result = await publisher.getLatestVersion(createContext());

      expect(result).toBe("2.0.0");
    });
  });

  describe("publish", () => {
    test("returns error when not authenticated", async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const result = await publisher.publish(createContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not logged in");
    });

    test("calls requestPublish and uploads tarball", async () => {
      mockIsAuthenticated.mockResolvedValue(true);

      const mockRequestPublish = mock(() => Promise.resolve({
        uploadUrl: "https://storage.example.com/upload",
        expiresAt: "2025-01-01T00:00:00Z",
      }));
      const mockConfirmPublish = mock(() => Promise.resolve());

      mockCreateRegistryClient.mockReturnValue({
        requestPublish: mockRequestPublish,
        confirmPublish: mockConfirmPublish,
      });

      mockFetch.mockResolvedValue({ ok: true });

      const ctx = createContext();
      const result = await publisher.publish(ctx);

      expect(result.success).toBe(true);
      expect(mockRequestPublish).toHaveBeenCalledWith(expect.objectContaining({
        artifactId: "@scope/artifact",
        version: "1.0.0",
        categories: ["agents"],
      }));
      expect(mockConfirmPublish).toHaveBeenCalledWith(expect.objectContaining({
        artifactId: "@scope/artifact",
        version: "1.0.0",
      }));
    });

    test("returns error when upload fails", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        requestPublish: mock(() => Promise.resolve({
          uploadUrl: "https://storage.example.com/upload",
          expiresAt: "2025-01-01T00:00:00Z",
        })),
      });

      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await publisher.publish(createContext());

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    test("rethrows RegistryApiError from requestPublish", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        requestPublish: mock(() => Promise.reject(
          new RegistryApiError("Version exists", "VERSION_EXISTS")
        )),
      });

      await expect(publisher.publish(createContext())).rejects.toThrow(RegistryApiError);
    });

    test("succeeds even if confirmPublish fails", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        requestPublish: mock(() => Promise.resolve({
          uploadUrl: "https://storage.example.com/upload",
          expiresAt: "2025-01-01T00:00:00Z",
        })),
        confirmPublish: mock(() => Promise.reject(new Error("extraction failed"))),
      });

      mockFetch.mockResolvedValue({ ok: true });

      const result = await publisher.publish(createContext());

      expect(result.success).toBe(true);
    });
  });

  describe("resolves registry from context", () => {
    test("passes scope and projectRoot to resolveRegistry", async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      mockCreateRegistryClient.mockReturnValue({
        versionExists: mock(() => Promise.resolve(false)),
      });

      await publisher.versionExists(createContext({ scope: "@myorg", projectRoot: "/my/project" }));

      expect(mockResolveRegistry).toHaveBeenCalledWith("@myorg", null, "/my/project");
    });
  });
});

describe("isApiAuthenticated", () => {
  beforeEach(() => {
    mockIsAuthenticated.mockClear();
    mockIsSupabaseConfigured.mockClear();
  });

  test("returns false when Supabase is not configured", async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);

    const result = await isApiAuthenticated();

    expect(result).toBe(false);
  });

  test("returns true when authenticated", async () => {
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockIsAuthenticated.mockResolvedValue(true);

    const result = await isApiAuthenticated();

    expect(result).toBe(true);
  });

  test("returns false when authentication check fails", async () => {
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockIsAuthenticated.mockRejectedValue(new Error("network error"));

    const result = await isApiAuthenticated();

    expect(result).toBe(false);
  });
});
