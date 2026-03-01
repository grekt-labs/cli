import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { requireInitialized } from "./guards";
import { spyOnProcessExitThrowing, spyOnConsole } from "#/test-utils";

describe("guards", () => {
  const testDir = join(tmpdir(), ".grekt-test-guards");
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    processExitSpy = spyOnProcessExitThrowing();
    consoleErrorSpy = spyOnConsole("error");
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("requireInitialized", () => {
    test("does nothing when grekt.yaml exists", () => {
      writeFileSync(join(testDir, "grekt.yaml"), "artifacts: {}");

      requireInitialized(testDir);

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test("exits with code 1 when grekt.yaml is missing", () => {
      expect(() => requireInitialized(testDir)).toThrow("process.exit called");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
