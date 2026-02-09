import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { codexPlugin } from "./codex";

describe("codexPlugin", () => {
  const testDir = join(process.cwd(), ".test-codex-plugin");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("has correct configuration", () => {
    expect(codexPlugin.id).toBe("codex");
    expect(codexPlugin.name).toBe("Codex");
    expect(codexPlugin.targetFile).toBe("AGENTS.md");
  });

  test("getSyncPaths returns null (rules-only)", () => {
    expect(codexPlugin.getSyncPaths()).toBeNull();
  });

  test("getTargetPaths returns correct paths", () => {
    const targetPaths = codexPlugin.getTargetPaths();

    expect(targetPaths!.targetDir).toBe("");
    expect(targetPaths!.entryPoints).toEqual(["AGENTS.md"]);
  });

  test("targetExists detects file presence", () => {
    expect(codexPlugin.targetExists(testDir)).toBe(false);

    writeFileSync(join(testDir, "AGENTS.md"), "content");

    expect(codexPlugin.targetExists(testDir)).toBe(true);
  });

  test("creates file when createTarget is true", async () => {
    const result = await codexPlugin.sync({ version: 1, artifacts: {} }, testDir, { createTarget: true });

    expect(result.created).toContain("AGENTS.md");
    expect(existsSync(join(testDir, "AGENTS.md"))).toBe(true);
  });
});
