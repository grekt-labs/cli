import { describe, test, expect, mock, beforeEach } from "bun:test";
import * as context from "#/context";

// Mock shell.execFile to prevent actually opening a browser
const execFileMock = mock(() => "");
beforeEach(() => {
  execFileMock.mockClear();
  (context.shell as { execFile: typeof execFileMock }).execFile = execFileMock;
});

describe("oauth", () => {
  describe("openBrowser", () => {
    test("returns true when shell command succeeds", async () => {
      const { openBrowser } = await import("./oauth");
      const result = openBrowser("https://example.com");
      expect(result).toBe(true);
      expect(execFileMock).toHaveBeenCalled();
    });

    test("returns false when shell command throws", async () => {
      execFileMock.mockImplementationOnce(() => {
        throw new Error("command not found");
      });
      const { openBrowser } = await import("./oauth");
      const result = openBrowser("https://example.com");
      expect(result).toBe(false);
    });

    test("handles URL with special characters", async () => {
      const { openBrowser } = await import("./oauth");
      const result = openBrowser("https://example.com/callback?code=abc&state=xyz");
      expect(result).toBe(true);
      expect(execFileMock).toHaveBeenCalled();
    });
  });

  describe("browserLogin", () => {
    test("is exported as async function", async () => {
      const { browserLogin } = await import("./oauth");
      expect(typeof browserLogin).toBe("function");
    });
  });

  describe("emailLogin", () => {
    test("is exported as async function", async () => {
      const { emailLogin } = await import("./oauth");
      expect(typeof emailLogin).toBe("function");
    });
  });
});
