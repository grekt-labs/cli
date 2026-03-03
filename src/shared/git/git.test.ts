import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockExecFile, mockWarning } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockWarning: vi.fn(),
}));

vi.mock("#/context", () => ({
  shell: {
    execFile: mockExecFile,
  },
}));

vi.mock("#/shared/ui/ui", () => ({
  warning: mockWarning,
}));

import { detectArtifactBaseRef, createArtifactTag } from "./git";

beforeEach(() => {
  mockExecFile.mockReset();
  mockWarning.mockReset();
});

function mockGitSequence(responses: Array<string | Error>) {
  for (const response of responses) {
    if (response instanceof Error) {
      mockExecFile.mockImplementationOnce(() => {
        throw response;
      });
    } else {
      mockExecFile.mockReturnValueOnce(response);
    }
  }
}

describe("detectArtifactBaseRef", () => {
  test("returns matching artifact tag", () => {
    mockGitSequence(["@scope/core@1.2.0"]);

    expect(detectArtifactBaseRef("@scope/core")).toBe("@scope/core@1.2.0");
    expect(mockExecFile).toHaveBeenCalledWith("git", [
      "describe",
      "--tags",
      "--abbrev=0",
      "--match",
      "@scope/core@*",
    ]);
  });

  test("falls back to first commit when no artifact tag", () => {
    mockGitSequence([
      new Error("no tag"),
      "abc123",
    ]);

    expect(detectArtifactBaseRef("@scope/core")).toBe("abc123");
  });

  test("falls back to HEAD~1 when no tags and no first commit", () => {
    mockGitSequence([
      new Error("no tag"),
      new Error("no commits"),
    ]);

    expect(detectArtifactBaseRef("@scope/core")).toBe("HEAD~1");
    expect(mockWarning).toHaveBeenCalled();
  });
});

describe("createArtifactTag", () => {
  test("creates tag in @scope/name@version format", () => {
    mockGitSequence([""]);

    createArtifactTag("@scope/core", "1.2.0");

    expect(mockExecFile).toHaveBeenCalledWith("git", [
      "tag",
      "@scope/core@1.2.0",
    ]);
  });

  test("pushes tag to origin in CI", () => {
    process.env.CI = "true";
    mockGitSequence(["", ""]);

    createArtifactTag("@scope/core", "1.2.0");

    expect(mockExecFile).toHaveBeenCalledWith("git", [
      "push",
      "origin",
      "@scope/core@1.2.0",
    ]);
    delete process.env.CI;
  });

  test("does not push tag outside CI", () => {
    delete process.env.CI;
    mockGitSequence([""]);

    createArtifactTag("@scope/core", "1.2.0");

    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  test("throws when git tag fails", () => {
    mockGitSequence([new Error("tag already exists")]);

    expect(() => createArtifactTag("@scope/core", "1.2.0")).toThrow();
  });

  test("does not throw when push fails in CI", () => {
    process.env.CI = "true";
    mockGitSequence(["", new Error("no remote")]);

    expect(() => createArtifactTag("@scope/core", "1.2.0")).not.toThrow();
    delete process.env.CI;
  });
});
