import { describe, test, expect } from "bun:test";
import { continuePlugin } from "./continue";

describe("continuePlugin", () => {
  test("has correct configuration", () => {
    expect(continuePlugin.id).toBe("continue");
    expect(continuePlugin.name).toBe("Continue");
    expect(continuePlugin.targetFile).toBe(".continue");
  });

  test("getSyncPaths returns category paths under .continue", () => {
    const paths = continuePlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".continue/agents");
    expect(paths!.skills).toBe(".continue/skills");
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = continuePlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe(".continue");
    expect(targetPaths!.entryPoints).toEqual([]);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(continuePlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });
});
