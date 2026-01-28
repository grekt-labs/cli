import { describe, test, expect } from "bun:test";

describe("version", () => {
  test("module can be imported", async () => {
    const module = await import("./version");
    expect(module).toBeDefined();
    expect(module.versionCommand).toBeDefined();
  });

  test("command has correct name and description", async () => {
    const { versionCommand } = await import("./version");
    expect(versionCommand.name()).toBe("version");
    expect(versionCommand.description()).toContain("version");
  });

  test("command accepts --dry-run option", async () => {
    const { versionCommand } = await import("./version");
    const options = versionCommand.options;
    const dryRunOption = options.find(opt => opt.long === "--dry-run");
    expect(dryRunOption).toBeDefined();
  });

  // Integration test scenarios (require git repo with conventional commits):
  // - Scans directories for grekt.yaml
  // - Generates temporary package.json files
  // - Runs multi-semantic-release
  // - Updates grekt.yaml with new versions
  // - Cleans up temporary files
});
