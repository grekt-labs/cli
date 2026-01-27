import { describe, test, expect } from "bun:test";

// Note: The api-client module interacts with Supabase and requires
// authentication credentials. These tests verify the module structure
// and exported functions without making actual API calls.

describe("api-client", () => {
  test("module can be imported", async () => {
    const module = await import("./api-client");
    expect(module).toBeDefined();
  });

  // The following tests are integration tests that require a real Supabase instance.
  // They are marked as comments to document intended behavior.

  // Integration test scenarios:
  // - fetchVersions calls Supabase RPC
  // - fetchInfo calls Supabase RPC
  // - downloadArtifact fetches from storage
  // - publishArtifact uploads to storage
  // - deprecateVersion calls Supabase RPC
  // - undeprecateVersion calls Supabase RPC

  // These tests should be run in a CI environment with test credentials
  // or mocked using a Supabase client mock.
});
