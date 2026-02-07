import { describe, test, expect } from "bun:test";
import { RegistryError } from "./registry-error";

describe("RegistryError", () => {
  test("sets message, code and name correctly", () => {
    const err = new RegistryError("Scope not found", "SCOPE_NOT_FOUND");

    expect(err.message).toBe("Scope not found");
    expect(err.code).toBe("SCOPE_NOT_FOUND");
    expect(err.name).toBe("RegistryError");
    expect(err.details).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
  });

  test("includes details when provided", () => {
    const err = new RegistryError("Insert failed", "INSERT_FAILED", "duplicate key");

    expect(err.code).toBe("INSERT_FAILED");
    expect(err.details).toBe("duplicate key");
  });
});
