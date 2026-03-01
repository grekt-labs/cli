import { describe, test, expect } from "vitest";

describe("check display", () => {
  test("module can be imported", async () => {
    const module = await import("./display");
    expect(module.displayCheckResults).toBeDefined();
    expect(typeof module.displayCheckResults).toBe("function");
  });
});
