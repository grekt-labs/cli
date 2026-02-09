import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { clinePlugin } from "./cline";

describe("clinePlugin", () => {
  const testDir = join(process.cwd(), ".test-cline-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(clinePlugin.id).toBe("cline");
    expect(clinePlugin.name).toBe("Cline");
    expect(clinePlugin.targetFile).toBe(".clinerules");
  });

  test("getSyncPaths returns null (rules-only)", () => {
    expect(clinePlugin.getSyncPaths()).toBeNull();
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = clinePlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe("");
    expect(targetPaths!.entryPoints).toEqual([".clinerules"]);
  });

  test("targetExists detects file presence", () => {
    expect(clinePlugin.targetExists(testDir)).toBe(false);

    writeFileSync(join(testDir, ".clinerules"), "content");

    expect(clinePlugin.targetExists(testDir)).toBe(true);
  });

  test("creates file when createTarget is true", async () => {
    const result = await clinePlugin.sync({ version: 1, artifacts: {} }, testDir, { createTarget: true });

    expect(result.created).toContain(".clinerules");
    expect(existsSync(join(testDir, ".clinerules"))).toBe(true);
  });
});
