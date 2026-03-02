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

import {
  detectBaseRef,
  detectArtifactBaseRef,
  getWidestBaseRef,
  getChangedFiles,
  getCommitsForPath,
} from "./git";

beforeEach(() => {
  mockExecFile.mockReset();
  mockWarning.mockReset();
});

/**
 * Helper to mock sequential git calls.
 * Each entry maps to one shell.execFile call in order.
 */
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

describe("detectBaseRef", () => {
  // Error paths
  test("throws for invalid --since ref", () => {
    mockGitSequence([new Error("not a ref")]);

    expect(() => detectBaseRef("invalid-ref")).toThrow("Invalid ref: invalid-ref");
  });

  // Override via --since
  test("returns override ref when --since is valid", () => {
    mockGitSequence(["abc123"]);

    expect(detectBaseRef("v1.0.0")).toBe("v1.0.0");
  });

  // Default branch returns null (per-artifact resolution)
  test("returns null on default branch", () => {
    mockGitSequence([
      "main",   // rev-parse --abbrev-ref HEAD
      "refs/remotes/origin/HEAD", // symbolic-ref (won't match, returns raw)
    ]);
    // detectDefaultBranch parses "refs/remotes/origin/HEAD" → last part is "HEAD"
    // but currentBranch is "main", so need to make symbolic-ref return something with "main"
    mockExecFile.mockReset();
    mockGitSequence([
      "main",                              // current branch
      "refs/remotes/origin/main",          // symbolic-ref → "main"
    ]);

    expect(detectBaseRef()).toBeNull();
  });

  test("returns null for detached HEAD", () => {
    mockGitSequence([
      "HEAD",                              // current branch (detached)
      "refs/remotes/origin/main",          // symbolic-ref
    ]);

    expect(detectBaseRef()).toBeNull();
  });

  // Feature branch
  test("returns origin/main on feature branch with remote", () => {
    mockGitSequence([
      "feat/something",                    // current branch
      "refs/remotes/origin/main",          // symbolic-ref → "main"
      "origin",                            // remote
    ]);

    expect(detectBaseRef()).toBe("origin/main");
  });

  test("returns default branch name when no remote", () => {
    mockGitSequence([
      "feat/something",                    // current branch
      "refs/remotes/origin/main",          // symbolic-ref → "main"
      new Error("no remote"),              // no remote
    ]);

    expect(detectBaseRef()).toBe("main");
    expect(mockWarning).toHaveBeenCalledWith(
      "No remote found, falling back to local refs",
    );
  });

  // Default branch detection fallback
  test("defaults to main when symbolic-ref fails", () => {
    mockGitSequence([
      "main",                              // current branch
      new Error("no symbolic ref"),        // symbolic-ref fails → default "main"
    ]);

    expect(detectBaseRef()).toBeNull();
  });
});

describe("detectArtifactBaseRef", () => {
  // Happy path: tag found
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

  // No tag, fallback to first commit
  test("falls back to first commit when no artifact tag", () => {
    mockGitSequence([
      new Error("no tag"),                 // describe fails
      "abc123",                            // rev-list first commit
    ]);

    expect(detectArtifactBaseRef("@scope/core")).toBe("abc123");
  });

  // No tag, no first commit (edge case)
  test("falls back to HEAD~1 when no tags and no first commit", () => {
    mockGitSequence([
      new Error("no tag"),                 // describe fails
      new Error("no commits"),             // rev-list fails
    ]);

    expect(detectArtifactBaseRef("@scope/core")).toBe("HEAD~1");
    expect(mockWarning).toHaveBeenCalled();
  });
});

describe("getWidestBaseRef", () => {
  test("returns oldest tag commit when tags exist", () => {
    mockGitSequence([
      "abc123\ndef456\nghi789",            // rev-list --tags --reverse
      "000000",                            // first commit (not used)
    ]);

    expect(getWidestBaseRef()).toBe("abc123");
  });

  test("falls back to first commit when no tags", () => {
    mockGitSequence([
      new Error("no tags"),                // rev-list --tags fails
      "first123",                          // first commit
    ]);

    expect(getWidestBaseRef()).toBe("first123");
  });

  test("falls back to HEAD~1 when nothing exists", () => {
    mockGitSequence([
      new Error("no tags"),
      new Error("no commits"),
    ]);

    expect(getWidestBaseRef()).toBe("HEAD~1");
  });
});

describe("getChangedFiles", () => {
  test("returns empty array when no changes", () => {
    mockGitSequence([""]);

    expect(getChangedFiles("v1.0.0")).toEqual([]);
  });

  test("returns file list from triple-dot diff", () => {
    mockGitSequence(["src/a.ts\nsrc/b.ts\n"]);

    expect(getChangedFiles("v1.0.0")).toEqual(["src/a.ts", "src/b.ts"]);
  });

  test("falls back to two-arg diff when triple-dot fails", () => {
    mockGitSequence([
      new Error("bad revision"),           // triple-dot fails
      "src/a.ts\n",                        // two-arg diff
    ]);

    expect(getChangedFiles("abc123")).toEqual(["src/a.ts"]);
  });

  test("returns empty array when both diffs fail", () => {
    mockGitSequence([
      new Error("fail"),
      new Error("fail"),
    ]);

    expect(getChangedFiles("abc123")).toEqual([]);
  });
});

describe("getCommitsForPath", () => {
  test("returns empty array when no commits", () => {
    mockGitSequence([""]);

    expect(getCommitsForPath("v1.0.0", "packages/core")).toEqual([]);
  });

  test("returns commit lines for path", () => {
    mockGitSequence([
      "abc123 feat: add feature\ndef456 fix: bug\n",
    ]);

    expect(getCommitsForPath("v1.0.0", "packages/core")).toEqual([
      "abc123 feat: add feature",
      "def456 fix: bug",
    ]);
  });

  test("uses double-dot range", () => {
    mockGitSequence(["abc123 feat: something\n"]);

    getCommitsForPath("v1.0.0", "packages/core");

    expect(mockExecFile).toHaveBeenCalledWith("git", [
      "log",
      "--format=%H %s",
      "v1.0.0..HEAD",
      "--",
      "packages/core",
    ]);
  });

  test("returns empty array when git log fails", () => {
    mockGitSequence([new Error("fail")]);

    expect(getCommitsForPath("v1.0.0", "packages/core")).toEqual([]);
  });
});
