import { describe, test, expect } from "bun:test";

describe("outdated", () => {
  test("command has correct name", async () => {
    const { outdatedCommand } = await import("./outdated");
    expect(outdatedCommand.name()).toBe("outdated");
  });
});
