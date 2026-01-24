import { describe, test } from "bun:test";

describe("session", () => {
  test.todo("getSession returns stored session");
  test.todo("saveSession persists session to file");
  test.todo("clearSession removes session file");
  test.todo("isSessionValid checks expiry");
  test.todo("refreshSession updates expired session");
  test.todo("getSupabaseClient returns configured client");
});
