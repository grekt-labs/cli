import { describe, test, expect } from "vitest";
import { ProjectConfigSchema, hasManifestFields } from "@grekt/engine";

describe("version", () => {
  test("command has correct name", async () => {
    const { versionCommand } = await import("./version");
    expect(versionCommand.name()).toBe("version");
  });

  describe("manifest validation", () => {
    test("ProjectConfigSchema parses config without manifest fields", () => {
      const projectConfig = {
        targets: ["claude"],
        artifacts: { "@scope/tool": "1.0.0" },
      };

      const result = ProjectConfigSchema.safeParse(projectConfig);
      expect(result.success).toBe(true);
    });

    test("hasManifestFields returns false for project config", () => {
      const projectConfig = ProjectConfigSchema.parse({
        targets: ["claude"],
        artifacts: { "@scope/tool": "1.0.0" },
      });

      expect(hasManifestFields(projectConfig)).toBe(false);
    });

    test("hasManifestFields returns true for artifact manifest", () => {
      const artifactManifest = ProjectConfigSchema.parse({
        name: "@scope/my-artifact",
        version: "1.0.0",
        description: "My artifact",
        keywords: ["test"],
      });

      expect(hasManifestFields(artifactManifest)).toBe(true);
    });

    test("hasManifestFields returns false when keywords are missing", () => {
      const incompleteManifest = ProjectConfigSchema.parse({
        name: "@scope/my-artifact",
        version: "1.0.0",
        description: "My artifact",
      });

      expect(hasManifestFields(incompleteManifest)).toBe(false);
    });
  });
});
