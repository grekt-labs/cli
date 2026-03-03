import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ArtifactChangelog } from "./changelog.types";
import type { WorkspaceArtifact } from "@grekt-labs/cli-engine";

const { mockExists, mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockExists: vi.fn(() => true),
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock("#/context", () => ({
  fs: {
    exists: mockExists,
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
}));

import {
  generateChangesetFiles,
  previewChangesetContent,
  formatJson,
  formatYaml,
} from "./changeset-output";

beforeEach(() => {
  mockExists.mockClear();
  mockMkdir.mockClear();
  mockWriteFile.mockClear();
});

function createArtifactChangelog(
  overrides: Partial<{
    name: string;
    version: string;
    bump: "patch" | "minor" | "major";
    commits: ArtifactChangelog["commits"];
    changedFiles: string[];
  }> = {},
): ArtifactChangelog {
  const name = overrides.name ?? "@scope/core";
  const version = overrides.version ?? "1.0.0";

  return {
    artifact: {
      path: "/workspace/packages/core",
      relativePath: "packages/core",
      manifest: { name, version, description: "test" },
    } as WorkspaceArtifact,
    commits: overrides.commits ?? [
      {
        hash: "abc123",
        type: "feat",
        scope: null,
        breaking: false,
        message: "add feature",
        raw: "abc123 feat: add feature",
      },
    ],
    calculatedBump: overrides.bump ?? "minor",
    changedFiles: overrides.changedFiles ?? ["packages/core/src/index.ts"],
  };
}

describe("generateChangesetFiles", () => {
  // Error paths / edge cases
  test("creates .changeset directory when it does not exist", () => {
    mockExists.mockReturnValue(false);

    generateChangesetFiles([createArtifactChangelog()], "/workspace");

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining(".changeset"),
      { recursive: true },
    );
  });

  test("does not recreate .changeset directory when it exists", () => {
    mockExists.mockReturnValue(true);

    generateChangesetFiles([createArtifactChangelog()], "/workspace");

    expect(mockMkdir).not.toHaveBeenCalled();
  });

  // Single artifact produces one file
  test("writes one file for a single artifact", () => {
    const paths = generateChangesetFiles(
      [createArtifactChangelog()],
      "/workspace",
    );

    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain(".changeset");
    expect(paths[0]).toMatch(/\.md$/);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  test("writes valid changeset content to file", () => {
    generateChangesetFiles([createArtifactChangelog()], "/workspace");

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    expect(writtenContent).toContain("---");
    expect(writtenContent).toContain('"@scope/core": minor');
  });

  // Multiple artifacts produce separate isolated files
  test("writes one file per artifact with isolated content", () => {
    const artifacts = [
      createArtifactChangelog({
        name: "@scope/core",
        bump: "minor",
        commits: [
          {
            hash: "abc123",
            type: "feat",
            scope: null,
            breaking: false,
            message: "add core feature",
            raw: "abc123 feat: add core feature",
          },
        ],
      }),
      createArtifactChangelog({
        name: "@scope/cli",
        bump: "patch",
        commits: [
          {
            hash: "def456",
            type: "fix",
            scope: null,
            breaking: false,
            message: "fix cli bug",
            raw: "def456 fix: fix cli bug",
          },
        ],
      }),
    ];

    const paths = generateChangesetFiles(artifacts, "/workspace");

    expect(paths).toHaveLength(2);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);

    const coreContent = mockWriteFile.mock.calls[0][1] as string;
    expect(coreContent).toContain('"@scope/core": minor');
    expect(coreContent).not.toContain("@scope/cli");

    const cliContent = mockWriteFile.mock.calls[1][1] as string;
    expect(cliContent).toContain('"@scope/cli": patch');
    expect(cliContent).not.toContain("@scope/core");
  });

  // Idempotency
  test("generates unique filenames on consecutive calls", () => {
    const paths1 = generateChangesetFiles(
      [createArtifactChangelog()],
      "/workspace",
    );
    const paths2 = generateChangesetFiles(
      [createArtifactChangelog()],
      "/workspace",
    );

    expect(paths1[0]).not.toBe(paths2[0]);
  });
});

describe("previewChangesetContent", () => {
  // Boundary: no commits
  test("handles artifact with no commits", () => {
    const artifacts = [createArtifactChangelog({ commits: [] })];
    const content = previewChangesetContent(artifacts);

    expect(content).toContain("changed files detected");
  });

  // Structure validation
  test("frontmatter starts and ends with ---", () => {
    const artifacts = [createArtifactChangelog()];
    const content = previewChangesetContent(artifacts);
    const lines = content.split("\n");

    expect(lines[0]).toBe("---");
    const secondDash = lines.indexOf("---", 1);
    expect(secondDash).toBeGreaterThan(0);
  });

  // Happy paths
  test("generates valid changeset frontmatter format", () => {
    const artifacts = [createArtifactChangelog()];
    const content = previewChangesetContent(artifacts);

    expect(content).toContain('"@scope/core": minor');
    expect(content).toContain("- @scope/core: feat: add feature");
  });

  test("includes multiple artifacts in frontmatter", () => {
    const artifacts = [
      createArtifactChangelog({ name: "@scope/core", bump: "minor" }),
      createArtifactChangelog({ name: "@scope/cli", bump: "patch" }),
    ];
    const content = previewChangesetContent(artifacts);

    expect(content).toContain('"@scope/core": minor');
    expect(content).toContain('"@scope/cli": patch');
  });

  test("handles major bump", () => {
    const artifacts = [
      createArtifactChangelog({
        bump: "major",
        commits: [
          {
            hash: "abc123",
            type: "feat",
            scope: null,
            breaking: true,
            message: "breaking api",
            raw: "abc123 feat!: breaking api",
          },
        ],
      }),
    ];
    const content = previewChangesetContent(artifacts);

    expect(content).toContain('"@scope/core": major');
  });
});

describe("formatJson", () => {
  // Error paths
  test("handles empty artifacts array", () => {
    const parsed = JSON.parse(formatJson([], "v1.0.0"));
    expect(parsed.artifacts).toEqual([]);
  });

  // Structure validation
  test("returns valid JSON", () => {
    const artifacts = [createArtifactChangelog()];
    const result = formatJson(artifacts, "v1.0.0");

    expect(() => JSON.parse(result)).not.toThrow();
  });

  test("does not include raw commit field in output", () => {
    const artifacts = [createArtifactChangelog()];
    const parsed = JSON.parse(formatJson(artifacts, "v1.0.0"));

    expect(parsed.artifacts[0].commits[0].raw).toBeUndefined();
  });

  // Happy paths
  test("includes baseRef and artifact details", () => {
    const artifacts = [createArtifactChangelog()];
    const parsed = JSON.parse(formatJson(artifacts, "origin/main"));

    expect(parsed.baseRef).toBe("origin/main");
    expect(parsed.artifacts).toHaveLength(1);
    expect(parsed.artifacts[0].name).toBe("@scope/core");
    expect(parsed.artifacts[0].version).toBe("1.0.0");
    expect(parsed.artifacts[0].bump).toBe("minor");
    expect(parsed.artifacts[0].commits).toHaveLength(1);
    expect(parsed.artifacts[0].changedFiles).toHaveLength(1);
  });
});

describe("formatYaml", () => {
  // Boundary
  test("handles empty artifacts", () => {
    const result = formatYaml([], "v1.0.0");
    expect(result).toContain("baseRef");
    expect(result).toContain("artifacts");
  });

  // Happy paths
  test("includes baseRef and artifact name", () => {
    const artifacts = [createArtifactChangelog()];
    const result = formatYaml(artifacts, "v1.0.0");

    expect(result).toContain("baseRef: v1.0.0");
    expect(result).toContain("@scope/core");
  });
});
