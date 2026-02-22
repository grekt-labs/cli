/**
 * Integration test: publish token resolution chain.
 *
 * Verifies that stored session tokens flow through to the registry client.
 * This is the exact integration point that broke when api-publisher migrated
 * from the old Supabase-coupled api-client to cli-engine's DefaultRegistryClient.
 *
 * Chain under test:
 *   getGlobalSession().access_token
 *     → createTokenProvider(root, getToken, getSessionToken)
 *       → resolveRegistry(scope, config, tokens)
 *         → registry.token (used by DefaultRegistryClient for Authorization header)
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTokenProvider } from "#/context/tokens";
import { resolveRegistry } from "@grekt-labs/cli-engine";

describe("publish token resolution chain", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GREKT_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("session token reaches registry.token when GREKT_TOKEN is not set", () => {
    const sessionAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-session-token";
    const getSessionToken = () => sessionAccessToken;
    const tokens = createTokenProvider("/project", () => undefined, getSessionToken);

    const registry = resolveRegistry("@test", null, tokens);

    expect(registry.token).toBe(sessionAccessToken);
  });

  test("GREKT_TOKEN takes priority over session token", () => {
    process.env.GREKT_TOKEN = "grk_ci_token_123";
    const getSessionToken = () => "session-token-should-not-be-used";
    const tokens = createTokenProvider("/project", () => undefined, getSessionToken);

    const registry = resolveRegistry("@test", null, tokens);

    expect(registry.token).toBe("grk_ci_token_123");
  });

  test("registry.token is undefined when no session and no GREKT_TOKEN", () => {
    const getSessionToken = () => undefined;
    const tokens = createTokenProvider("/project", () => undefined, getSessionToken);

    const registry = resolveRegistry("@test", null, tokens);

    expect(registry.token).toBeUndefined();
  });

  test("session token is not used when getSessionToken is not provided", () => {
    const tokens = createTokenProvider("/project", () => undefined);

    const registry = resolveRegistry("@test", null, tokens);

    expect(registry.token).toBeUndefined();
  });

  test("resolved registry type is default for unscoped registries", () => {
    const getSessionToken = () => "some-token";
    const tokens = createTokenProvider("/project", () => undefined, getSessionToken);

    const registry = resolveRegistry("@test", null, tokens);

    expect(registry.type).toBe("default");
    expect(registry.token).toBe("some-token");
  });
});
