import { describe, test, expect, mock } from "bun:test";

const execFileMock = mock(() => "");

// Only override shell, re-export everything else from the real module
const realContext = await import("#/context");
mock.module("#/context", () => ({
  ...realContext,
  shell: { execFile: execFileMock },
}));

const { openBrowser, browserLogin, emailLogin } = await import("./oauth");

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

    test("handles URL with special characters", () => {
      execFileMock.mockImplementation(() => "");
      const result = openBrowser(
        "https://example.com/callback?code=abc&state=xyz",
      );
      expect(result).toBe(true);
    });
  });

  describe("browserLogin", () => {
    test("is exported as async function", () => {
      expect(typeof browserLogin).toBe("function");
    });
  });

  describe("emailLogin", () => {
    test("is exported as async function", () => {
      expect(typeof emailLogin).toBe("function");
    });
  });
});
