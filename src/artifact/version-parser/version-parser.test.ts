import { describe, test, expect } from "bun:test";
import { parseArtifactVersion } from "./version-parser";

describe("parseArtifactVersion", () => {
  test("parses scoped artifact with version", () => {
    const result = parseArtifactVersion("@grekt/code-reviewer@1.0.0");
    expect(result).toEqual({
      artifactId: "@grekt/code-reviewer",
      version: "1.0.0",
    });
  });

  test("parses artifact with pre-release version", () => {
    const result = parseArtifactVersion("@scope/name@2.0.0-beta.1");
    expect(result).toEqual({
      artifactId: "@scope/name",
      version: "2.0.0-beta.1",
    });
  });

  test("parses artifact with complex scope", () => {
    const result = parseArtifactVersion("@my-org/my-artifact@0.1.0");
    expect(result).toEqual({
      artifactId: "@my-org/my-artifact",
      version: "0.1.0",
    });
  });

  test("returns null for missing version", () => {
    expect(parseArtifactVersion("@scope/name")).toBeNull();
  });

  test("returns null for missing scope", () => {
    expect(parseArtifactVersion("name@1.0.0")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseArtifactVersion("")).toBeNull();
  });

  test("returns null for just @", () => {
    expect(parseArtifactVersion("@")).toBeNull();
  });

  test("handles version with build metadata", () => {
    const result = parseArtifactVersion("@scope/name@1.0.0+build.123");
    expect(result).toEqual({
      artifactId: "@scope/name",
      version: "1.0.0+build.123",
    });
  });
});
