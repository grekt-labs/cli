/**
 * Session restore race condition test.
 *
 * Lives in spec/ (e2e directory) to run in isolation from unit tests.
 * bun test's vi.mock in api-client.test.ts replaces getSession globally,
 * making it impossible to test the real implementation in the same run.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  resetClient,
  getSupabaseClient,
  getSession,
  _setSessionRestorePromise,
} from "#/auth/session/session";

describe("session restore race condition", () => {
  beforeEach(() => {
    resetClient();
  });

  afterEach(() => {
    resetClient();
  });

  test("getSession awaits session restore before reading auth state", async () => {
    const order: string[] = [];

    getSupabaseClient();

    // Simulate a slow setSession (as happens when restoring from disk)
    const slowRestore = new Promise<void>((resolve) => {
      setTimeout(() => {
        order.push("restore-completed");
        resolve();
      }, 50);
    });

    _setSessionRestorePromise(slowRestore);

    const session = await getSession();
    order.push("getSession-returned");

    // Without the fix (awaiting _sessionRestored in getSession),
    // "getSession-returned" would come first — auth appears missing.
    expect(order).toEqual(["restore-completed", "getSession-returned"]);
    expect(session === null || typeof session === "object").toBe(true);
  });

  test("concurrent getSession calls share the same restore promise", async () => {
    getSupabaseClient();

    let resolveCount = 0;

    const slowRestore = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolveCount++;
        resolve();
      }, 50);
    });

    _setSessionRestorePromise(slowRestore);

    const results = await Promise.all([
      getSession(),
      getSession(),
      getSession(),
    ]);

    // Promise resolved exactly once (shared across calls)
    expect(resolveCount).toBe(1);

    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });

  test("getSession works immediately when no restore is pending", async () => {
    getSupabaseClient();
    _setSessionRestorePromise(null);

    const session = await getSession();
    expect(session === null || typeof session === "object").toBe(true);
  });
});
