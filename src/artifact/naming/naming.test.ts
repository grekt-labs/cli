import { describe, test } from "bun:test";

describe("naming", () => {
  test.todo("getSafeFilename removes @ and replaces / with -");
  test.todo("getSafeFilename extracts basename from filepath");
  test.todo("getSafeFilename handles nested paths");
  test.todo("toSafeName converts @scope/name to scope-name");
  test.todo("toSafeName handles unscoped names");
});
