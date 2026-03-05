import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockSpawn } from "#/test-utils";

const mockSpawn = createMockSpawn();

const { mockExistsSync, mockExecSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockExecSync: vi.fn(() => ""),
}));

vi.mock("child_process", async (importOriginal) => ({
  ...(await importOriginal()),
  spawn: mockSpawn.spawn,
  execSync: mockExecSync,
}));

vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal()),
  existsSync: mockExistsSync,
}));

const { openBrowser } = await import("./oauth");

const originalPlatform = process.platform;

describe("oauth", () => {
  describe("openBrowser", () => {
    beforeEach(() => {
      mockSpawn.reset();
      mockExistsSync.mockClear();
      mockExecSync.mockClear();
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue("");
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    test("returns false when spawn throws synchronously", () => {
      mockSpawn.spawn.mockImplementation(() => {
        throw new Error("command not found");
      });
      const result = openBrowser("https://example.com");
      expect(result).toBe(false);
    });

    test("registers error handler on spawned child process", () => {
      openBrowser("https://example.com");
      expect(mockSpawn.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    test("passes URL as argument array to prevent injection", () => {
      openBrowser("https://example.com/callback?code=abc&state=xyz");

      const lastCall = mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
      const args = lastCall[1] as string[];
      expect(args).toContain("https://example.com/callback?code=abc&state=xyz");
    });

    test("spawns detached process and unrefs it", () => {
      openBrowser("https://example.com");

      const lastCall = mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
      const options = lastCall[2] as { detached: boolean; stdio: string };
      expect(options.detached).toBe(true);
      expect(options.stdio).toBe("ignore");
      expect(mockSpawn.unref).toHaveBeenCalled();
    });

    describe("WSL detection", () => {
      beforeEach(() => {
        Object.defineProperty(process, "platform", { value: "linux" });
      });

      test("uses cmd.exe when /proc/version contains microsoft", () => {
        mockExistsSync.mockReturnValue(true);
        mockExecSync.mockReturnValue(
          "Linux version 5.15.153.1-microsoft-standard-WSL2",
        );

        openBrowser("https://example.com");

        const lastCall =
          mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
        const command = lastCall[0] as string;
        const args = lastCall[1] as string[];
        expect(command).toBe("cmd.exe");
        expect(args).toEqual(["/c", "start", "", "https://example.com"]);
      });

      test("falls back to xdg-open when /proc/version does not exist", () => {
        mockExistsSync.mockReturnValue(false);

        openBrowser("https://example.com");

        const lastCall =
          mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
        const command = lastCall[0] as string;
        expect(command).toBe("xdg-open");
      });

      test("falls back to xdg-open when /proc/version has no WSL marker", () => {
        mockExistsSync.mockReturnValue(true);
        mockExecSync.mockReturnValue(
          "Linux version 6.1.0-18-amd64 (debian-kernel@lists.debian.org)",
        );

        openBrowser("https://example.com");

        const lastCall =
          mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
        const command = lastCall[0] as string;
        expect(command).toBe("xdg-open");
      });

      test("falls back to xdg-open when execSync throws", () => {
        mockExistsSync.mockReturnValue(true);
        mockExecSync.mockImplementation(() => {
          throw new Error("permission denied");
        });

        openBrowser("https://example.com");

        const lastCall =
          mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
        const command = lastCall[0] as string;
        expect(command).toBe("xdg-open");
      });
    });

    describe("platform selection", () => {
      test("uses open on macOS", () => {
        Object.defineProperty(process, "platform", { value: "darwin" });

        openBrowser("https://example.com");

        const lastCall =
          mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
        expect(lastCall[0]).toBe("open");
      });

      test("uses rundll32 on Windows", () => {
        Object.defineProperty(process, "platform", { value: "win32" });

        openBrowser("https://example.com");

        const lastCall =
          mockSpawn.spawn.mock.calls[mockSpawn.spawn.mock.calls.length - 1];
        expect(lastCall[0]).toBe("rundll32");
      });
    });
  });
});
