import { describe, test } from "bun:test";

describe("resolver", () => {
  test.todo("parseArtifactId parses @scope/name format");
  test.todo("parseArtifactId parses @scope/name@version format");
  test.todo("resolveRegistry returns config for scope");
  test.todo("resolveRegistry falls back to default registry");
  test.todo("getTokenForScope resolves env var first");
  test.todo("getTokenForScope falls back to config token");
});
