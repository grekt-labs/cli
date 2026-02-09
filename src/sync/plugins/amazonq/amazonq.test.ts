import { describe, test, expect } from "bun:test";
import { amazonqPlugin } from "./amazonq";

describe("amazonqPlugin", () => {
  test("has correct configuration", () => {
    expect(amazonqPlugin.id).toBe("amazonq");
    expect(amazonqPlugin.name).toBe("Amazon Q");
    expect(amazonqPlugin.targetFile).toBe(".amazonq");
  });

  test("getSyncPaths returns category paths under .amazonq", () => {
    const paths = amazonqPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".amazonq/agents");
    expect(paths!.skills).toBe(".amazonq/skills");
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = amazonqPlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe(".amazonq");
    expect(targetPaths!.entryPoints).toEqual([]);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(amazonqPlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });
});
