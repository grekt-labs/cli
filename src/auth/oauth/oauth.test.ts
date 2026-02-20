import { describe, test, expect, mock } from "bun:test";

const execFileMock = mock(() => "");

const realContext = await import("#/context");
mock.module("#/context", () => ({
  ...realContext,
  shell: { execFile: execFileMock },
}));

const { openBrowser } = await import("./oauth");

describe("oauth", () => {
  describe("openBrowser", () => {
    test("returns true when shell command succeeds", () => {
      execFileMock.mockImplementation(() => "");
      const result = openBrowser("https://example.com");
      expect(result).toBe(true);
    });

    test("returns false when shell command throws", () => {
      execFileMock.mockImplementation(() => {
        throw new Error("command not found");
      });
      const result = openBrowser("https://example.com");
      expect(result).toBe(false);
    });

    test("passes URL to shell command", () => {
      execFileMock.mockImplementation(() => "");
      openBrowser("https://example.com/callback?code=abc&state=xyz");

      const lastCall = execFileMock.mock.calls[execFileMock.mock.calls.length - 1];
      const urlArg = lastCall[1] as string[];
      expect(urlArg).toContain("https://example.com/callback?code=abc&state=xyz");
    });
  });
});
