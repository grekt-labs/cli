import { describe, test, expect } from "bun:test";
import { openBrowser } from "./oauth";

describe("oauth", () => {
  describe("openBrowser", () => {
    test("returns boolean", () => {
      // openBrowser will return true/false based on platform command
      // We can't fully test browser opening without side effects
      // but we can verify the function signature works
      const result = openBrowser("https://example.com");
      expect(typeof result).toBe("boolean");
    });

    test("handles URL with special characters", () => {
      // Should not throw
      const result = openBrowser("https://example.com/callback?code=abc&state=xyz");
      expect(typeof result).toBe("boolean");
    });
  });

  // Note: browserLogin and emailLogin tests require mocking Supabase client
  // which is complex due to the module structure. These are integration tests
  // that should be tested with actual Supabase instance or comprehensive mocking.

  describe("browserLogin", () => {
    test("is exported as async function", async () => {
      const { browserLogin } = await import("./oauth");
      expect(typeof browserLogin).toBe("function");
    });
  });

  describe("emailLogin", () => {
    test("is exported as async function", async () => {
      const { emailLogin } = await import("./oauth");
      expect(typeof emailLogin).toBe("function");
    });
  });
});
