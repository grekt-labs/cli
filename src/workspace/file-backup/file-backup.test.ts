import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("file-backup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grekt-test-backup-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("backs up existing file and restores it with original content", async () => {
    const { backupFiles, restoreFiles } = await import("./file-backup");

    const filePath = join(tempDir, "package.json");
    const originalContent = '{ "name": "my-project", "version": "1.0.0" }';
    writeFileSync(filePath, originalContent);

    const manifest = backupFiles([filePath]);

    expect(manifest.size).toBe(1);
    expect(manifest.has(filePath)).toBe(true);

    // Overwrite the original file (simulating what --exec does)
    writeFileSync(filePath, '{ "name": "workspace-root", "private": true }');

    restoreFiles(manifest);

    const restored = readFileSync(filePath, "utf-8");
    expect(restored).toBe(originalContent);
  });

  test("skips non-existing paths (manifest is empty for them)", async () => {
    const { backupFiles } = await import("./file-backup");

    const manifest = backupFiles([
      join(tempDir, "does-not-exist.json"),
      join(tempDir, "also-missing.yaml"),
    ]);

    expect(manifest.size).toBe(0);
  });

  test("backup files in /tmp are cleaned up after restore", async () => {
    const { backupFiles, restoreFiles } = await import("./file-backup");

    const filePath = join(tempDir, "pnpm-workspace.yaml");
    writeFileSync(filePath, "packages: [packages/*]");

    const manifest = backupFiles([filePath]);
    const backupPath = manifest.get(filePath)!;

    expect(existsSync(backupPath)).toBe(true);

    restoreFiles(manifest);

    expect(existsSync(backupPath)).toBe(false);
  });

  test("empty manifest makes restoreFiles a no-op", async () => {
    const { restoreFiles } = await import("./file-backup");

    const manifest = new Map<string, string>();

    expect(() => restoreFiles(manifest)).not.toThrow();
  });

  test("handles mixed existing and non-existing paths", async () => {
    const { backupFiles, restoreFiles } = await import("./file-backup");

    const existingFile = join(tempDir, "existing.json");
    const missingFile = join(tempDir, "missing.json");
    writeFileSync(existingFile, "original content");

    const manifest = backupFiles([existingFile, missingFile]);

    expect(manifest.size).toBe(1);
    expect(manifest.has(existingFile)).toBe(true);
    expect(manifest.has(missingFile)).toBe(false);

    writeFileSync(existingFile, "overwritten");
    restoreFiles(manifest);

    expect(readFileSync(existingFile, "utf-8")).toBe("original content");
  });
});
