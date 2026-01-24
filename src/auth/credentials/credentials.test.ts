import { describe, test } from "bun:test";

describe("credentials", () => {
  test.todo("getCredentials returns stored credentials");
  test.todo("saveCredentials writes to file with chmod 600");
  test.todo("getToken resolves from env first");
  test.todo("getToken falls back to file credentials");
  test.todo("getTokenForScope uses scope-specific env var");
  test.todo("clearCredentials removes credentials file");
});
