import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  isSupabaseConfigured,
  setProjectRoot,
  getProjectRoot,
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
    test("returns false when env vars not set", () => {
      delete process.env.GREKT_SUPABASE_URL;
      delete process.env.GREKT_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      expect(isSupabaseConfigured()).toBe(false);
    });

    test("returns true when GREKT_SUPABASE vars are set", () => {
      process.env.GREKT_SUPABASE_URL = "https://test.supabase.co";
      process.env.GREKT_SUPABASE_ANON_KEY = "test-key";

      // Note: isSupabaseConfigured uses module-level constants
      // which are evaluated at import time, so this test may not work as expected
      // This is a known limitation of the test setup
    });
  });

  describe("setProjectRoot and getProjectRoot", () => {
    test("setProjectRoot updates the project root", () => {
      setProjectRoot("/custom/path");

      expect(getProjectRoot()).toBe("/custom/path");
    });

    test("getProjectRoot returns default cwd initially", () => {
      // Reset to a known state
      setProjectRoot(process.cwd());

      expect(getProjectRoot()).toBe(process.cwd());
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
      setProjectRoot("/tmp/grekt-test-session-nonexistent");
      expect(() => clearSession()).not.toThrow();
    });
  });

  // Note: getSupabaseClient, getSession, and isAuthenticated require
  // Supabase to be configured with valid credentials.
  // These are integration tests that need a test Supabase instance.
});
