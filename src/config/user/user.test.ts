import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  getGlobalSession,
  saveGlobalSession,
  clearGlobalSession,
  getGlobalSessionPath,
} from "./user";
import type { StoredSession } from "@grekt/engine";

describe("user config", () => {
  const sessionPath = join(homedir(), ".grekt", "session.yaml");

  // Save original session if exists
  let originalSession: StoredSession | null = null;

  beforeEach(() => {
    originalSession = getGlobalSession();
    if (existsSync(sessionPath)) {
      rmSync(sessionPath);
    }
  });

  afterEach(() => {
    // Restore original session
    if (originalSession) {
      saveGlobalSession(originalSession);
    } else if (existsSync(sessionPath)) {
      rmSync(sessionPath);
    }
  });

  describe("getGlobalSessionPath", () => {
    test("returns path in home directory", () => {
      const path = getGlobalSessionPath();
      expect(path).toBe(sessionPath);
    });
  });

  describe("getGlobalSession", () => {
    test("returns null when no session exists", () => {
      const session = getGlobalSession();
      expect(session).toBeNull();
    });
  });

  describe("saveGlobalSession", () => {
    test("saves and retrieves session", () => {
      const session: StoredSession = {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_at: 12345,
      };

      saveGlobalSession(session);
      const retrieved = getGlobalSession();

      expect(retrieved).not.toBeNull();
      expect(retrieved!.access_token).toBe("test-access");
      expect(retrieved!.refresh_token).toBe("test-refresh");
      expect(retrieved!.expires_at).toBe(12345);
    });
  });

  describe("clearGlobalSession", () => {
    test("removes session file", () => {
      const session: StoredSession = {
        access_token: "test-access",
        refresh_token: "test-refresh",
      };

      saveGlobalSession(session);
      expect(existsSync(sessionPath)).toBe(true);

      clearGlobalSession();
      expect(existsSync(sessionPath)).toBe(false);
    });

    test("does not throw when session does not exist", () => {
      expect(() => clearGlobalSession()).not.toThrow();
    });
  });
});
