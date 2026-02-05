import { describe, test, expect } from "bun:test";
import { ProjectConfigSchema, hasManifestFields } from "@grekt-labs/cli-engine";

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

  // Integration test scenarios (require git repo with conventional commits):
  // - Scans directories for grekt.yaml
  // - Generates temporary package.json files
  // - Runs multi-semantic-release
  // - Updates grekt.yaml with new versions
  // - Cleans up temporary files
});
