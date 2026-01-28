import { describe, test, expect } from "bun:test";

// Note: The outdated command interacts with the registry API and requires
// authentication/lockfile. These tests verify the module structure.

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

  // Integration test scenarios (require lockfile and registry access):
  // - Filters out github: and gitlab: sources
  // - Compares versions using semver
  // - Shows outdated artifacts with current vs latest
  // - Shows "up to date" message when all current
});
