import { describe, test, expect } from "vitest";

describe("workspace", () => {
  test("module can be imported", async () => {
    const module = await import("./workspace");
    expect(module.loadWorkspace).toBeDefined();
    expect(module.generatePackageJsonFiles).toBeDefined();
    expect(module.syncVersionsToManifest).toBeDefined();
    expect(module.cleanPackageJsonFiles).toBeDefined();
    expect(typeof module.loadWorkspace).toBe("function");
  });

  test("command module re-exports from domain module", async () => {
    const domain = await import("./workspace");
    const command = await import("#/commands/workspace");

    expect(command.loadWorkspace).toBe(domain.loadWorkspace);
    expect(command.generatePackageJsonFiles).toBe(domain.generatePackageJsonFiles);
    expect(command.syncVersionsToManifest).toBe(domain.syncVersionsToManifest);
    expect(command.cleanPackageJsonFiles).toBe(domain.cleanPackageJsonFiles);
  });
});
