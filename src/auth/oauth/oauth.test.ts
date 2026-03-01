import { describe, test, expect, vi, beforeEach } from "vitest";
import { createMockSpawn } from "#/test-utils";

const mockSpawn = createMockSpawn();

vi.mock("child_process", async (importOriginal) => ({
  ...(await importOriginal()),
  spawn: mockSpawn.spawn,
}));

const { openBrowser } = await import("./oauth");

describe("oauth", () => {
  describe("openBrowser", () => {
    beforeEach(() => {
      mockSpawn.reset();
    });

    test("returns true when spawn succeeds", () => {
      const result = openBrowser("https://example.com");
      expect(result).toBe(true);
    });

    test("returns false when spawn throws", () => {
      mockSpawn.spawn.mockImplementation(() => {
        throw new Error("command not found");
      });
      const result = openBrowser("https://example.com");
      expect(result).toBe(false);
    });

    test("passes URL as argument to spawn", () => {
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
  });
});
