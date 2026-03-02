import { describe, test, expect } from "vitest";
import {
  parseConventionalCommit,
  determineBumpType,
  mapFilesToArtifacts,
} from "./conventional-commits";
import type { ConventionalCommit } from "./changelog.types";
import type { WorkspaceArtifact } from "@grekt-labs/cli-engine";

describe("parseConventionalCommit", () => {
  // Error paths first
  test("returns null for non-conventional commit", () => {
    expect(parseConventionalCommit("abc123 just a message")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseConventionalCommit("")).toBeNull();
  });

  test("returns null for hash only", () => {
    expect(parseConventionalCommit("abc123")).toBeNull();
  });

  test("returns null for message without colon separator", () => {
    expect(parseConventionalCommit("abc123 feat something")).toBeNull();
  });

  test("returns null for line with only whitespace", () => {
    expect(parseConventionalCommit("   ")).toBeNull();
  });

  // Security edges
  test("returns null for input with null bytes", () => {
    expect(parseConventionalCommit("abc123 feat: \0 injection")).toBeNull();
  });

  test("handles unicode zero-width characters in message", () => {
    const result = parseConventionalCommit("abc123 feat: add \u200B feature");
    expect(result).toEqual(
      expect.objectContaining({ type: "feat" }),
    );
  });

  test("handles RTL mark in message", () => {
    const result = parseConventionalCommit("abc123 fix: resolve \u200F issue");
    expect(result).toEqual(
      expect.objectContaining({ type: "fix" }),
    );
  });

  // Boundary conditions
  test("trims extra whitespace after colon", () => {
    const result = parseConventionalCommit("abc123 feat:   spaced message");
    expect(result).toEqual(
      expect.objectContaining({ message: "spaced message" }),
    );
  });

  test("handles message with colons", () => {
    const result = parseConventionalCommit(
      "abc123 fix: error: something: broke",
    );
    expect(result).toEqual(
      expect.objectContaining({ message: "error: something: broke" }),
    );
  });

  test("parses full 40-char hash", () => {
    const hash = "a".repeat(40);
    const result = parseConventionalCommit(`${hash} fix: something`);
    expect(result).toEqual(
      expect.objectContaining({ hash }),
    );
  });

  // Happy paths
  test("parses feat commit", () => {
    const result = parseConventionalCommit("abc123 feat: add new feature");
    expect(result).toEqual({
      hash: "abc123",
      type: "feat",
      scope: null,
      breaking: false,
      message: "add new feature",
      raw: "abc123 feat: add new feature",
    });
  });

  test("parses fix commit", () => {
    const result = parseConventionalCommit("def456 fix: resolve crash");
    expect(result).toEqual(
      expect.objectContaining({
        type: "fix",
        message: "resolve crash",
      }),
    );
  });

  test("parses commit with scope", () => {
    const result = parseConventionalCommit("abc123 feat(auth): add login");
    expect(result).toEqual(
      expect.objectContaining({
        scope: "auth",
        type: "feat",
      }),
    );
  });

  test("parses breaking change with bang", () => {
    const result = parseConventionalCommit("abc123 feat!: remove old api");
    expect(result).toEqual(
      expect.objectContaining({ breaking: true }),
    );
  });

  test("parses breaking change with scope and bang", () => {
    const result = parseConventionalCommit(
      "abc123 refactor(core)!: rewrite engine",
    );
    expect(result).toEqual(
      expect.objectContaining({
        breaking: true,
        scope: "core",
      }),
    );
  });

  test("detects BREAKING CHANGE in message body", () => {
    const result = parseConventionalCommit(
      "abc123 feat: new api BREAKING CHANGE",
    );
    expect(result).toEqual(
      expect.objectContaining({ breaking: true }),
    );
  });

  test("parses refactor type", () => {
    const result = parseConventionalCommit("abc123 refactor: clean up code");
    expect(result).toEqual(
      expect.objectContaining({ type: "refactor" }),
    );
  });

  test("parses chore type", () => {
    const result = parseConventionalCommit("abc123 chore: update deps");
    expect(result).toEqual(
      expect.objectContaining({ type: "chore" }),
    );
  });
});

describe("determineBumpType", () => {
  function commit(
    overrides: Partial<ConventionalCommit> = {},
  ): ConventionalCommit {
    return {
      hash: "abc123",
      type: "fix",
      scope: null,
      breaking: false,
      message: "test",
      raw: "abc123 fix: test",
      ...overrides,
    };
  }

  // Boundary
  test("returns patch for empty array", () => {
    expect(determineBumpType([])).toBe("patch");
  });

  // Priority logic
  test("major takes priority over minor", () => {
    const commits = [
      commit({ type: "feat" }),
      commit({ type: "fix", breaking: true }),
    ];
    expect(determineBumpType(commits)).toBe("major");
  });

  test("returns major when any commit is breaking", () => {
    const commits = [
      commit({ type: "fix" }),
      commit({ type: "feat", breaking: true }),
    ];
    expect(determineBumpType(commits)).toBe("major");
  });

  test("returns minor when any commit is feat", () => {
    const commits = [commit({ type: "fix" }), commit({ type: "feat" })];
    expect(determineBumpType(commits)).toBe("minor");
  });

  test("returns patch when all commits are fix/chore/etc", () => {
    const commits = [
      commit({ type: "fix" }),
      commit({ type: "chore" }),
      commit({ type: "refactor" }),
    ];
    expect(determineBumpType(commits)).toBe("patch");
  });

  test("returns patch for single fix commit", () => {
    expect(determineBumpType([commit({ type: "fix" })])).toBe("patch");
  });

  test("returns minor for single feat commit", () => {
    expect(determineBumpType([commit({ type: "feat" })])).toBe("minor");
  });
});

describe("mapFilesToArtifacts", () => {
  function artifact(relativePath: string): WorkspaceArtifact {
    return {
      path: `/workspace/${relativePath}`,
      relativePath,
      manifest: {
        name: `@scope/${relativePath.replace("/", "-")}`,
        version: "1.0.0",
        description: "test",
      },
    } as WorkspaceArtifact;
  }

  // Error paths / boundaries
  test("returns empty map for empty files array", () => {
    const artifacts = [artifact("packages/core")];
    const result = mapFilesToArtifacts([], artifacts);
    expect(result.size).toBe(0);
  });

  test("returns empty map for empty artifacts array", () => {
    const result = mapFilesToArtifacts(["some/file.ts"], []);
    expect(result.size).toBe(0);
  });

  test("returns empty map when no files match artifacts", () => {
    const artifacts = [artifact("packages/core")];
    const files = ["other/file.ts", "README.md"];

    const result = mapFilesToArtifacts(files, artifacts);
    expect(result.size).toBe(0);
  });

  test("ignores root-level files outside any artifact", () => {
    const artifacts = [artifact("packages/core")];
    const files = [".gitignore", "package.json"];

    const result = mapFilesToArtifacts(files, artifacts);
    expect(result.size).toBe(0);
  });

  test("does not match partial path names", () => {
    const artifacts = [artifact("packages/core")];
    const files = ["packages/core-utils/src/index.ts"];

    const result = mapFilesToArtifacts(files, artifacts);
    expect(result.size).toBe(0);
  });

  // Security edges
  test("does not match path traversal attempts", () => {
    const artifacts = [artifact("packages/core")];
    const files = ["../packages/core/src/index.ts"];

    const result = mapFilesToArtifacts(files, artifacts);
    expect(result.size).toBe(0);
  });

  // Happy paths
  test("maps files to correct artifacts", () => {
    const artifacts = [artifact("packages/core"), artifact("packages/cli")];
    const files = ["packages/core/src/index.ts", "packages/cli/src/main.ts"];

    const result = mapFilesToArtifacts(files, artifacts);

    expect(result.size).toBe(2);
    expect(result.get("packages/core")).toEqual(["packages/core/src/index.ts"]);
    expect(result.get("packages/cli")).toEqual(["packages/cli/src/main.ts"]);
  });

  test("groups multiple files under same artifact", () => {
    const artifacts = [artifact("packages/core")];
    const files = [
      "packages/core/src/a.ts",
      "packages/core/src/b.ts",
      "packages/core/README.md",
    ];

    const result = mapFilesToArtifacts(files, artifacts);
    expect(result.get("packages/core")).toHaveLength(3);
  });

  test("matches artifacts with backslash paths (Windows)", () => {
    const windowsArtifact = {
      path: "C:\\workspace\\packages\\core",
      relativePath: "packages\\core",
      manifest: {
        name: "@scope/core",
        version: "1.0.0",
        description: "test",
      },
    } as WorkspaceArtifact;

    const files = ["packages/core/src/index.ts"];
    const result = mapFilesToArtifacts(files, [windowsArtifact]);

    expect(result.size).toBe(1);
    expect(result.get("packages\\core")).toEqual([
      "packages/core/src/index.ts",
    ]);
  });

  test("each file maps to only one artifact (first match)", () => {
    const artifacts = [artifact("packages"), artifact("packages/core")];
    const files = ["packages/core/src/index.ts"];

    const result = mapFilesToArtifacts(files, artifacts);
    expect(result.size).toBe(1);
    expect(result.has("packages")).toBe(true);
  });
});
