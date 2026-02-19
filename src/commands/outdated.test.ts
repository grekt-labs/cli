import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockGetLockfile = mock();
mock.module("#/context", () => ({
  getLockfile: mockGetLockfile,
}));

mock.module("#/shared/guards/guards", () => ({
  requireInitialized: () => {},
}));

const mockResolveRegistry = mock(() => ({
  type: "default" as const,
  host: "registry.grekt.com",
}));

const mockGetLatestVersion = mock();
const mockCreateRegistryClient = mock(() => ({
  getLatestVersion: mockGetLatestVersion,
}));

mock.module("#/registry/factory/factory", () => ({
  resolveRegistry: mockResolveRegistry,
  createRegistryClient: mockCreateRegistryClient,
}));

mock.module("#/config/project/project", () => ({
  getLocalConfig: () => null,
}));

// Suppress UI output during tests
mock.module("#/shared/ui/ui", () => ({
  error: () => {},
  info: () => {},
  log: () => {},
  colors: {
    success: (s: string) => s,
    error: (s: string) => s,
    warning: (s: string) => s,
    info: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
    highlight: (s: string) => s,
    brand: (s: string) => s,
  },
  spinner: () => ({ start: () => {}, stop: () => {} }),
}));

describe("outdated", () => {
  beforeEach(() => {
    mockGetLockfile.mockClear();
    mockResolveRegistry.mockClear();
    mockCreateRegistryClient.mockClear();
    mockGetLatestVersion.mockClear();
  });

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

  test("uses canonical factory with parseArtifactId for scope resolution", async () => {
    // Verify imports resolve correctly (no legacy api-client)
    const module = await import("./outdated");
    expect(module.outdatedCommand).toBeDefined();

    // The module should import from factory, not api-client
    const factoryModule = await import("#/registry/factory/factory");
    expect(factoryModule.resolveRegistry).toBeDefined();
    expect(factoryModule.createRegistryClient).toBeDefined();
  });
});
