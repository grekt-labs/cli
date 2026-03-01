import { describe, test, expect } from "vitest";
import { windsurfPlugin } from "./windsurf";

describe("windsurfPlugin", () => {
  test("has correct configuration", () => {
    expect(windsurfPlugin.id).toBe("windsurf");
    expect(windsurfPlugin.name).toBe("Windsurf");
    expect(windsurfPlugin.targetFile).toBe(".windsurf");
  });

  test("getSyncPaths returns category paths under .windsurf", () => {
    const paths = windsurfPlugin.getSyncPaths();

    expect(paths).not.toBeNull();
    expect(paths!.agents).toBe(".windsurf/agents");
    expect(paths!.skills).toBe(".windsurf/skills");
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = windsurfPlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe(".windsurf");
    expect(targetPaths!.entryPoints).toEqual([".windsurfrules"]);
  });

  test("targetExists returns false for nonexistent path", () => {
    expect(windsurfPlugin.targetExists("/path/that/does/not/exist")).toBe(false);
  });
});
