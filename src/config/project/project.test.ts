import { describe, test } from "bun:test";

describe("project", () => {
  test.todo("getConfig returns parsed ProjectConfig");
  test.todo("getConfig applies defaults for missing fields");
  test.todo("saveConfig writes valid YAML");
  test.todo("setConfigValue updates single key");
  test.todo("isInitialized returns true when grekt.yaml exists");
  test.todo("isInitialized returns false when grekt.yaml missing");
  test.todo("ensureGlobalConfigDir creates ~/.grekt if missing");
  test.todo("getLocalConfig returns null when config.yaml missing");
  test.todo("getLocalConfig parses LocalConfig");
  test.todo("saveLocalConfig writes with chmod 600");
});
