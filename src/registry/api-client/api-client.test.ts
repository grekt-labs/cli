import { describe, test, expect, beforeEach, afterEach, vi } from "bun:test";

let mockSupabase: any;
let mockSession: any;
let mockSupabaseUrl = "https://supabase.test";

vi.mock("#/auth/session/session", () => ({
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

  test("module exports RegistryClient", async () => {
    const module = await import("./api-client");
    expect(module.RegistryClient).toBeDefined();
    expect(module.createRegistryClient).toBeDefined();
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

    await expect(client.publish("@org/tool", "1.0.0")).rejects.toThrow("Not authenticated");
  });

  test("publish calls edge function with bearer token", async () => {
    mockSession = { access_token: "token" };
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ uploadUrl: "https://upload.test" }),
    })) as unknown as typeof fetch;

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    const result = await client.publish("@org/tool", "1.0.0");

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

  test("deprecate throws on error", async () => {
    mockSupabase = createSupabaseMock({
      versions: {
        update: { data: null, error: { message: "fail" } },
      },
    });

    const { RegistryClient } = await import("./api-client");
    const client = new RegistryClient();

    await expect(client.deprecate("@org/tool", "1.0.0", "no")).rejects.toThrow("Failed to deprecate");
  });
});
