import { describe, test, expect } from "vitest";

describe("outdated", () => {
  test("command has correct name", async () => {
    const { outdatedCommand } = await import("./outdated");
    expect(outdatedCommand.name()).toBe("outdated");
  });
});
