import { describe, test, expect } from "bun:test";
import { sortVersionsDesc } from "@grekt-labs/cli-engine";
import { createMetadata, deprecateVersion, undeprecateVersion, updateMetadataVersion } from "./metadata";

describe("metadata", () => {
  describe("createMetadata", () => {
    test("returns valid metadata structure with correct artifact id", () => {
      const metadata = createMetadata("@scope/tool", "1.0.0");

      expect(metadata.name).toBe("@scope/tool");
      expect(metadata.latest).toBe("1.0.0");
      expect(metadata.deprecated).toEqual({});
      expect(metadata.createdAt).toBe(metadata.updatedAt);
    });

    test("sets timestamps to ISO format", () => {
      const metadata = createMetadata("@scope/tool", "1.0.0");

      expect(() => new Date(metadata.createdAt)).not.toThrow();
      expect(new Date(metadata.createdAt).toISOString()).toBe(metadata.createdAt);
    });
  });

  describe("updateMetadataVersion", () => {
    test("updates latest version and updatedAt", () => {
      const original = createMetadata("@scope/tool", "1.0.0");
      const updated = updateMetadataVersion(original, "2.0.0");

      expect(updated.latest).toBe("2.0.0");
      expect(updated.name).toBe("@scope/tool");
      expect(updated.createdAt).toBe(original.createdAt);
    });
  });

  describe("deprecateVersion", () => {
    test("adds deprecation message for specific version", () => {
      const metadata = createMetadata("@scope/tool", "2.0.0");
      const deprecated = deprecateVersion(metadata, "1.0.0", "Use v2 instead");

      expect(deprecated.deprecated["1.0.0"]).toBe("Use v2 instead");
      expect(deprecated.latest).toBe("2.0.0");
    });

    test("preserves existing deprecations", () => {
      const metadata = createMetadata("@scope/tool", "3.0.0");
      const step1 = deprecateVersion(metadata, "1.0.0", "Old");
      const step2 = deprecateVersion(step1, "2.0.0", "Also old");

      expect(step2.deprecated["1.0.0"]).toBe("Old");
      expect(step2.deprecated["2.0.0"]).toBe("Also old");
    });
  });

  describe("undeprecateVersion", () => {
    test("removes deprecation for specific version", () => {
      const metadata = createMetadata("@scope/tool", "2.0.0");
      const deprecated = deprecateVersion(metadata, "1.0.0", "Use v2");
      const restored = undeprecateVersion(deprecated, "1.0.0");

      expect(restored.deprecated["1.0.0"]).toBeUndefined();
    });

    test("preserves other deprecations", () => {
      const metadata = createMetadata("@scope/tool", "3.0.0");
      const step1 = deprecateVersion(metadata, "1.0.0", "Old");
      const step2 = deprecateVersion(step1, "2.0.0", "Also old");
      const restored = undeprecateVersion(step2, "1.0.0");

      expect(restored.deprecated["1.0.0"]).toBeUndefined();
      expect(restored.deprecated["2.0.0"]).toBe("Also old");
    });
  });
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
