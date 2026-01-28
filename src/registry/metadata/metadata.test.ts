import { describe, test, expect } from "bun:test";
import { sortVersionsDesc } from "@grekt-labs/cli-engine";

// Note: The metadata module interacts with S3/external storage.
// These tests document the expected behavior without making actual API calls.

describe("metadata", () => {
  test("module can be imported", async () => {
    const module = await import("./metadata");
    expect(module).toBeDefined();
  });

  test("exports required functions", async () => {
    const module = await import("./metadata");
    expect(module.getArtifactMetadata).toBeDefined();
    expect(module.saveArtifactMetadata).toBeDefined();
    expect(module.listVersions).toBeDefined();
    expect(module.createMetadata).toBeDefined();
    expect(module.deprecateVersion).toBeDefined();
    expect(module.undeprecateVersion).toBeDefined();
  });

  // Integration test scenarios (require S3 credentials):
  // - getMetadata fetches from S3
  // - saveMetadata uploads to S3
  // - createEmptyMetadata returns valid structure
  // - listVersions returns versions sorted by semver (highest first)

  // These tests should be run with test credentials in CI
  // or mocked using AWS SDK mocks.
});

describe("version sorting", () => {
  test("sortVersionsDesc sorts by semver (not lexically)", () => {
    const versions = ["1.0.0", "10.0.0", "2.0.0", "1.5.0"];
    const sorted = sortVersionsDesc(versions);
    expect(sorted).toEqual(["10.0.0", "2.0.0", "1.5.0", "1.0.0"]);
  });

  test("sortVersionsDesc filters invalid versions", () => {
    const versions = ["1.0.0", "banana", "v2.0.0", "3.0.0"];
    const sorted = sortVersionsDesc(versions);
    expect(sorted).toEqual(["3.0.0", "1.0.0"]);
  });
});
