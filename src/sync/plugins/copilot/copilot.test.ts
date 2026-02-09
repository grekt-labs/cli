import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { copilotPlugin } from "./copilot";

describe("copilotPlugin", () => {
  const testDir = join(process.cwd(), ".test-copilot-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(copilotPlugin.id).toBe("copilot");
    expect(copilotPlugin.name).toBe("Copilot");
    expect(copilotPlugin.targetFile).toBe(".github/copilot-instructions.md");
  });

  test("getSyncPaths returns null (rules-only)", () => {
    expect(copilotPlugin.getSyncPaths()).toBeNull();
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = copilotPlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe("");
    expect(targetPaths!.entryPoints).toEqual([".github/copilot-instructions.md"]);
  });

  test("targetExists detects file presence", () => {
    expect(copilotPlugin.targetExists(testDir)).toBe(false);

    mkdirSync(join(testDir, ".github"), { recursive: true });
    writeFileSync(join(testDir, ".github/copilot-instructions.md"), "content");

    expect(copilotPlugin.targetExists(testDir)).toBe(true);
  });

  test("creates file when createTarget is true", async () => {
    const result = await copilotPlugin.sync({ version: 1, artifacts: {} }, testDir, { createTarget: true });

    expect(result.created).toContain(".github/copilot-instructions.md");
    expect(existsSync(join(testDir, ".github/copilot-instructions.md"))).toBe(true);
  });
});
