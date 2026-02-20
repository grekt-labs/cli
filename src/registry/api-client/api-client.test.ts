import { describe, test, expect, beforeEach, afterEach, vi } from "bun:test";
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
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ uploadUrl: "https://upload.test", expiresAt: "2024-01-01T00:05:00Z" }),
    })) as unknown as typeof fetch;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const result = await client.publish({
      artifactId: "@org/tool",
      version: "1.0.0",
      description: "A test artifact",
      keywords: ["test", "demo", "example"],
    });

    expect(result.uploadUrl).toBe("https://upload.test");
    expect(globalThis.fetch).toHaveBeenCalledWith(
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
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await client.deprecate("@org/tool", { version: "1.0.0", message: "Use v2" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
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
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "You don't have permission", code: "SCOPE_NOT_OWNED" }),
    })) as unknown as typeof fetch;

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
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await client.undeprecate("@org/tool", "1.0.0");

    expect(globalThis.fetch).toHaveBeenCalledWith(
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
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Insert failed",
        code: "INSERT_FAILED",
        details: "duplicate key on artifact_id",
      }),
    })) as unknown as typeof fetch;

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
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: "something broke" }),
    })) as unknown as typeof fetch;

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
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error("not json"); },
    })) as unknown as typeof fetch;

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
});
