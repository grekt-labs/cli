import { describe, test } from "bun:test";

describe("factory", () => {
  test.todo("createRegistryClient returns default client for default type");
  test.todo("createRegistryClient returns gitlab client for gitlab type");
  test.todo("createRegistryClient throws for unknown type");
});
