import { describe, test } from "bun:test";

describe("oauth", () => {
  describe("openBrowser", () => {
    test.todo("returns true when browser opens successfully");
    test.todo("returns false when browser fails to open");
    test.todo("uses correct command for macOS");
    test.todo("uses correct command for Windows");
    test.todo("uses correct command for Linux");
  });

  describe("browserLogin", () => {
    test.todo("starts local HTTP server");
    test.todo("generates auth URL with PKCE");
    test.todo("calls onAuthUrl callback with URL");
    test.todo("exchanges code for session on callback");
    test.todo("rejects on OAuth error");
    test.todo("rejects on timeout");
  });

  describe("emailLogin", () => {
    test.todo("calls signInWithPassword");
    test.todo("throws on invalid credentials");
  });
});
