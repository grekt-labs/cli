import { describe, test, expect, beforeEach, afterEach, vi, mock } from "bun:test";
import { RegistryError } from "./registry-error";

let mockSupabase: any;
let mockSession: any;
let mockSupabaseUrl = "https://supabase.test";

const realSession = await import("#/auth/session/session");
vi.mock("#/auth/session/session", () => ({
  ...realSession,
  getSupabaseClient: () => mockSupabase,
  getSession: () => mockSession,
  getSupabaseUrl: () => mockSupabaseUrl,
}));

// Mocks for download() dependencies
const mockHttpFetch = mock();
const mockFsWriteFileBinary = mock();
const mockFsUnlink = mock();
const mockFsMkdir = mock();
const mockTarExtract = mock();
const mockTarList = mock(() => [{ path: "grekt.yaml", type: "file" }]);

mock.module("#/context", () => ({
  fs: {
    exists: () => true,
    readFile: () => "",
    writeFileBinary: mockFsWriteFileBinary,
    unlink: mockFsUnlink,
    mkdir: mockFsMkdir,
  },
  http: {
    fetch: mockHttpFetch,
  },
  tarOps: {
    extract: mockTarExtract,
    list: mockTarList,
  },
}));

function createQuery(table: string, handlers: Record<string, any>) {
  const query = {
    eq: () => query,
    single: async () => handlers[table]?.single ?? { data: null, error: null },
    then: (resolve: (value: any) => void, reject: (reason?: unknown) => void) => {
      Promise.resolve(handlers[table]?.list ?? { data: null, error: null }).then(resolve, reject);
    },
  };
  return query;
}

function createUpdateQuery(table: string, handlers: Record<string, any>) {
  const query = {
    eq: () => query,
    then: (resolve: (value: any) => void, reject: (reason?: unknown) => void) => {
      Promise.resolve(handlers[table]?.update ?? { data: null, error: null }).then(resolve, reject);
    },
  };
  return query;
}

function createSupabaseMock(handlers: Record<string, any>) {
  return {
    from: (table: string) => ({
      select: () => createQuery(table, handlers),
      update: () => createUpdateQuery(table, handlers),
    }),
    auth: {
      getUser: async () => handlers.auth?.getUser ?? { data: { user: null }, error: null },
    },
  };
}

describe("api-client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockSession = null;
    mockSupabase = createSupabaseMock({});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("getArtifact returns metadata with latest semver and updatedAt", async () => {
    mockSupabase = createSupabaseMock({
      artifacts: {
        single: {
          data: {
            id: "@org/tool",
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        },
      },
      versions: {
        list: {
          data: [
            { version: "1.0.0", deprecated_message: null, published_at: "2024-01-02T00:00:00Z" },
            { version: "1.2.0", deprecated_message: "use 2.x", published_at: "2024-01-03T00:00:00Z" },
            { version: "2.0.0", deprecated_message: null, published_at: "2024-01-01T00:00:00Z" },
          ],
          error: null,
        },
      },
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const result = await client.getArtifact("@org/tool");

    expect(result).not.toBeNull();
    expect(result!.latest).toBe("2.0.0");
    expect(result!.deprecated["1.2.0"]).toBe("use 2.x");
    expect(result!.updatedAt).toBe("2024-01-03T00:00:00Z");
  });

  test("getVersions sorts by semver desc and preserves deprecations", async () => {
    mockSupabase = createSupabaseMock({
      versions: {
        list: {
          data: [
            { version: "1.0.0", deprecated_message: null, published_at: "2024-01-02T00:00:00Z" },
            { version: "2.0.0", deprecated_message: "deprecated", published_at: "2024-01-03T00:00:00Z" },
            { version: "1.10.0", deprecated_message: null, published_at: "2024-01-04T00:00:00Z" },
          ],
          error: null,
        },
      },
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const versions = await client.getVersions("@org/tool");

    expect(versions.map(v => v.version)).toEqual(["2.0.0", "1.10.0", "1.0.0"]);
    expect(versions[0].deprecated).toBe("deprecated");
  });

  test("versionExists returns false on error", async () => {
    mockSupabase = createSupabaseMock({
      versions: {
        single: { data: null, error: new Error("no") },
      },
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const exists = await client.versionExists("@org/tool", "1.0.0");

    expect(exists).toBe(false);
  });

  test("whoami returns email when user exists", async () => {
    mockSupabase = createSupabaseMock({
      auth: {
        getUser: { data: { user: { email: "user@test.com" } }, error: null },
      },
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const result = await client.whoami();

    expect(result).toEqual({ email: "user@test.com" });
  });

  test("publish throws when not authenticated", async () => {
    mockSession = null;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await expect(client.publish({ artifactId: "@org/tool", version: "1.0.0" })).rejects.toThrow("Not authenticated");
  });

  test("publish calls edge function with bearer token", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ uploadUrl: "https://upload.test", expiresAt: "2024-01-01T00:05:00Z" }),
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const result = await client.publish({
      artifactId: "@org/tool",
      version: "1.0.0",
      description: "A test artifact",
      keywords: ["test", "demo", "example"],
    });

    expect(result.uploadUrl).toBe("https://upload.test");
    expect(mockHttpFetch).toHaveBeenCalledWith(
      "https://supabase.test/functions/v1/publish",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    );
  });

  test("deprecate throws when not authenticated", async () => {
    mockSession = null;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await expect(client.deprecate("@org/tool", { version: "1.0.0", message: "no" })).rejects.toThrow("Not authenticated");
  });

  test("deprecate calls edge function with bearer token", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await client.deprecate("@org/tool", { version: "1.0.0", message: "Use v2" });

    expect(mockHttpFetch).toHaveBeenCalledWith(
      "https://supabase.test/functions/v1/deprecate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    );
  });

  test("deprecate throws RegistryError on error response", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "You don't have permission", code: "SCOPE_NOT_OWNED" }),
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    try {
      await client.deprecate("@org/tool", { version: "1.0.0", message: "no" });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RegistryError);
      expect((err as RegistryError).message).toBe("You don't have permission");
      expect((err as RegistryError).code).toBe("SCOPE_NOT_OWNED");
    }
  });

  test("undeprecate throws when not authenticated", async () => {
    mockSession = null;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await expect(client.undeprecate("@org/tool", "1.0.0")).rejects.toThrow("Not authenticated");
  });

  test("undeprecate calls edge function with bearer token", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await client.undeprecate("@org/tool", "1.0.0");

    expect(mockHttpFetch).toHaveBeenCalledWith(
      "https://supabase.test/functions/v1/undeprecate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    );
  });

  test("publish throws RegistryError with code and details on error response", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Insert failed",
        code: "INSERT_FAILED",
        details: "duplicate key on artifact_id",
      }),
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    try {
      await client.publish({ artifactId: "@org/tool", version: "1.0.0" });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RegistryError);
      expect((err as RegistryError).message).toBe("Insert failed");
      expect((err as RegistryError).code).toBe("INSERT_FAILED");
      expect((err as RegistryError).details).toBe("duplicate key on artifact_id");
    }
  });

  test("publish throws RegistryError with UNKNOWN code when JSON has no code field", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "something broke" }),
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    try {
      await client.publish({ artifactId: "@org/tool", version: "1.0.0" });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RegistryError);
      expect((err as RegistryError).code).toBe("UNKNOWN");
      expect((err as RegistryError).message).toBe("Request failed with status 500");
    }
  });

  test("undeprecate throws RegistryError with UNKNOWN code when JSON parsing fails", async () => {
    mockSession = { access_token: "token" };
    mockHttpFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error("not json"); },
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    try {
      await client.undeprecate("@org/tool", "1.0.0");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RegistryError);
      expect((err as RegistryError).code).toBe("UNKNOWN");
      expect((err as RegistryError).message).toBe("Request failed with status 502");
    }
  });

  describe("download", () => {
    beforeEach(() => {
      mockHttpFetch.mockClear();
      mockFsWriteFileBinary.mockClear();
      mockFsUnlink.mockClear();
      mockFsMkdir.mockClear();
      mockTarExtract.mockClear();
      mockTarList.mockClear();
    });

    test("returns 404 ARTIFACT_NOT_FOUND error", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: "ARTIFACT_NOT_FOUND", error: "Not found" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/missing", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Artifact not found in registry");
    });

    test("returns 404 VERSION_NOT_FOUND error", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: "VERSION_NOT_FOUND", error: "No version" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "9.9.9", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Version 9.9.9 not found");
    });

    test("returns 404 FILE_NOT_FOUND error", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: "FILE_NOT_FOUND", error: "No file" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Artifact file not found in storage");
    });

    test("returns access denied for 401", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/private", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });

    test("returns access denied for 403", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/private", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });

    test("returns generic error for non-404 non-auth failures", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
    });

    test("returns network error for ECONNREFUSED", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("network error");
    });

    test("returns network error for ENOTFOUND", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockRejectedValue(new Error("ENOTFOUND"));

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("network error");
    });

    test("returns error when tarball download fails", async () => {
      mockSession = { access_token: "token" };

      // First call: signed URL success
      // Second call: tarball download fails
      let callCount = 0;
      mockHttpFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({ url: "https://storage.test/tarball.tar.gz", deprecated: null }),
          };
        }
        return { ok: false, status: 500 };
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Download failed");
    });

    test("returns error when 404 json parsing fails", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => { throw new Error("not json"); },
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.download("@org/tool", { version: "1.0.0", targetDir: "/tmp/target" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not found");
    });
  });

  describe("confirmPublish", () => {
    test("throws when not authenticated", async () => {
      mockSession = null;

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      await expect(
        client.confirmPublish({ artifactId: "@org/tool", version: "1.0.0" })
      ).rejects.toThrow("Not authenticated");
    });

    test("throws RegistryError on error response", async () => {
      mockSession = { access_token: "token" };
      mockHttpFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Version not found", code: "NOT_FOUND" }),
      });

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      try {
        await client.confirmPublish({ artifactId: "@org/tool", version: "1.0.0" });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(RegistryError);
        expect((err as RegistryError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("getLatestVersion", () => {
    test("returns null when artifact not found", async () => {
      mockSupabase = createSupabaseMock({});

      const { RegistryClient } = await import("./api-client");
      const client = new RegistryClient();

      const result = await client.getLatestVersion("@org/nonexistent");

      expect(result).toBeNull();
    });
  });
});
