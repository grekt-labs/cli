import { describe, test, expect } from "bun:test";

describe("outdated", () => {
  test("module can be imported", async () => {
    const module = await import("./outdated");
    expect(module).toBeDefined();
    expect(module.outdatedCommand).toBeDefined();
  });

  test("command has correct name and description", async () => {
    const { outdatedCommand } = await import("./outdated");
    expect(outdatedCommand.name()).toBe("outdated");
    expect(outdatedCommand.description()).toContain("outdated");
  });

  test("uses canonical factory (no legacy api-client imports)", async () => {
    const factoryModule = await import("#/registry/factory/factory");
    expect(factoryModule.resolveRegistry).toBeDefined();
    expect(factoryModule.createRegistryClient).toBeDefined();
  });
});
