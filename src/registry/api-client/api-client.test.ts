import { describe, test, expect } from "bun:test";

// Note: The api-client module interacts with Supabase and requires
// authentication credentials. These tests verify the module structure
// and exported functions without making actual API calls.

describe("api-client", () => {
  test("module can be imported", async () => {
    const module = await import("./api-client");
    expect(module).toBeDefined();
  });

  test("exports RegistryClient class", async () => {
    const module = await import("./api-client");
    expect(module.RegistryClient).toBeDefined();
    expect(module.createRegistryClient).toBeDefined();
  });

  // The following tests are integration tests that require a real Supabase instance.
  // They are marked as comments to document intended behavior.

  // Integration test scenarios:
  // - getArtifact returns metadata with latest = highest semver (not most recent publish)
  // - getVersions returns versions sorted by semver descending
  // - download fetches tarball and extracts
  // - publish uploads tarball
  // - deprecate updates version record
  // - undeprecate clears deprecation

  // These tests should be run in a CI environment with test credentials
  // or mocked using a Supabase client mock.
});
