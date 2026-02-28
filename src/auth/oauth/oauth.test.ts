import { describe, test, expect, mock, beforeEach } from "bun:test";

const unrefMock = mock(() => {});
const spawnMock = mock(() => ({ unref: unrefMock }));

const originalChildProcess = await import("child_process");

mock.module("child_process", () => ({
  ...originalChildProcess,
  spawn: spawnMock,
}));

const { openBrowser } = await import("./oauth");

describe("oauth", () => {
  describe("openBrowser", () => {
    beforeEach(() => {
      spawnMock.mockClear();
      unrefMock.mockClear();
      spawnMock.mockImplementation(() => ({ unref: unrefMock }));
    });

    test("returns true when spawn succeeds", () => {
      const result = openBrowser("https://example.com");
      expect(result).toBe(true);
    });

    test("returns false when spawn throws", () => {
      spawnMock.mockImplementation(() => {
        throw new Error("command not found");
      });
      const result = openBrowser("https://example.com");
      expect(result).toBe(false);
    });

    test("passes URL as argument to spawn", () => {
      openBrowser("https://example.com/callback?code=abc&state=xyz");

      const lastCall = spawnMock.mock.calls[spawnMock.mock.calls.length - 1];
      const args = lastCall[1] as string[];
      expect(args).toContain("https://example.com/callback?code=abc&state=xyz");
    });

    test("spawns detached process and unrefs it", () => {
      openBrowser("https://example.com");

      const lastCall = spawnMock.mock.calls[spawnMock.mock.calls.length - 1];
      const options = lastCall[2] as { detached: boolean; stdio: string };
      expect(options.detached).toBe(true);
      expect(options.stdio).toBe("ignore");
      expect(unrefMock).toHaveBeenCalled();
    });
  });
});
