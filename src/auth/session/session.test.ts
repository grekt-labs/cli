import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  isSupabaseConfigured,
  resetClient,
  clearSession,
  getSupabaseClient,
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

      expect(isSupabaseConfigured()).toBe(true);
    });

    test("returns true when GREKT_SUPABASE vars override defaults", () => {
      process.env.GREKT_SUPABASE_URL = "https://custom.supabase.co";
      process.env.GREKT_SUPABASE_ANON_KEY = "custom-key";
      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  describe("resetClient", () => {
    test("allows getSupabaseClient to be called again after reset", () => {
      getSupabaseClient();
      resetClient();

      // Should not throw, proving the client was cleared and recreated
      expect(() => getSupabaseClient()).not.toThrow();
    });
  });

  describe("clearSession", () => {
    test("does not throw when no session exists", () => {
      expect(() => clearSession()).not.toThrow();
    });
  });

  test("does not export setProjectRoot or getProjectRoot (removed)", async () => {
    const module = await import("./session");
    expect("setProjectRoot" in module).toBe(false);
    expect("getProjectRoot" in module).toBe(false);
  });
});
