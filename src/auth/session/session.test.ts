import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  isSupabaseConfigured,
  resetClient,
  clearSession,
} from "./session";

describe("session", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetClient();
  });

  describe("isSupabaseConfigured", () => {
    test("returns true with defaults (no env vars needed)", () => {
      delete process.env.GREKT_SUPABASE_URL;
      delete process.env.GREKT_SUPABASE_ANON_KEY;

      // Now always returns true because we have hardcoded defaults
      expect(isSupabaseConfigured()).toBe(true);
    });

    test("returns true when GREKT_SUPABASE vars override defaults", () => {
      process.env.GREKT_SUPABASE_URL = "https://custom.supabase.co";
      process.env.GREKT_SUPABASE_ANON_KEY = "custom-key";
      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  describe("resetClient", () => {
    test("can be called without error", () => {
      expect(() => resetClient()).not.toThrow();
    });

    test("can be called multiple times", () => {
      resetClient();
      resetClient();
      resetClient();
      expect(true).toBe(true);
    });
  });

  describe("clearSession", () => {
    test("can be called without error when no session exists", () => {
      expect(() => clearSession()).not.toThrow();
    });
  });

  test("does not export setProjectRoot or getProjectRoot (removed)", async () => {
    const module = await import("./session");
    expect("setProjectRoot" in module).toBe(false);
    expect("getProjectRoot" in module).toBe(false);
  });

  // Note: getSupabaseClient, getSession, and isAuthenticated require
  // Supabase to be configured with valid credentials.
  // These are integration tests that need a test Supabase instance.
});
