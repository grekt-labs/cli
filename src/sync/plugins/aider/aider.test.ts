import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { aiderPlugin } from "./aider";

describe("aiderPlugin", () => {
  const testDir = join(process.cwd(), ".test-aider-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(aiderPlugin.id).toBe("aider");
    expect(aiderPlugin.name).toBe("Aider");
    expect(aiderPlugin.targetFile).toBe("CONVENTIONS.md");
  });

  test("getSyncPaths returns null (rules-only)", () => {
    expect(aiderPlugin.getSyncPaths()).toBeNull();
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = aiderPlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe("");
    expect(targetPaths!.entryPoints).toEqual(["CONVENTIONS.md"]);
  });

  test("targetExists detects file presence", () => {
    expect(aiderPlugin.targetExists(testDir)).toBe(false);

    writeFileSync(join(testDir, "CONVENTIONS.md"), "content");

    expect(aiderPlugin.targetExists(testDir)).toBe(true);
  });

  test("creates file when createTarget is true", async () => {
    const result = await aiderPlugin.sync({ version: 1, artifacts: {} }, testDir, { createTarget: true });

    expect(result.created).toContain("CONVENTIONS.md");
    expect(existsSync(join(testDir, "CONVENTIONS.md"))).toBe(true);
  });
});
