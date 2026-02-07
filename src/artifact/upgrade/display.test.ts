import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockLog = mock(() => {});
const mockNewline = mock(() => {});
const mockSelectComponentsWithPrecheck = mock();

mock.module("#/shared/ui/ui", () => ({
  log: mockLog,
  newline: mockNewline,
  colors: {
    highlight: (s: string) => `[highlight:${s}]`,
    dim: (s: string) => `[dim:${s}]`,
    warning: (s: string) => `[warning:${s}]`,
    success: (s: string) => `[success:${s}]`,
  },
}));

mock.module("#/artifact/selector/selector", () => ({
  selectComponentsWithPrecheck: mockSelectComponentsWithPrecheck,
  createEmptySelection: () => ({
    agents: [],
    skills: [],
    commands: [],
    mcps: [],
    rules: [],
  }),
}));

import { promptStructuralChanges } from "./display";
import { createCategoryRecord } from "@grekt-labs/cli-engine";
import type { ArtifactInfo } from "@grekt-labs/cli-engine";
import type { StructureDiff } from "./upgrade.types";

function createArtifactInfo(): ArtifactInfo {
  return {
    manifest: { name: "@scope/test", version: "2.0.0", description: "desc" },
    invalidFiles: [],
    ...createCategoryRecord(() => []),
  };
}

describe("display", () => {
  beforeEach(() => {
    mockLog.mockClear();
    mockNewline.mockClear();
    mockSelectComponentsWithPrecheck.mockClear();
  });

  describe("promptStructuralChanges", () => {
    test("displays removed components", async () => {
      const diff: StructureDiff = {
        removedComponents: [{ category: "skills", path: "skills/old.md" }],
        addedComponents: [],
        hasStructuralChanges: true,
      };
      const expectedSelection = { agents: [], skills: ["skills/new.md"], commands: [], mcps: [], rules: [] };
      mockSelectComponentsWithPrecheck.mockResolvedValueOnce(expectedSelection);

      await promptStructuralChanges(
        "@scope/test",
        diff,
        createArtifactInfo(),
        { agents: [], skills: [], commands: [], mcps: [], rules: [] }
      );

      const allLogCalls = mockLog.mock.calls.map((c) => c[0]);
      expect(allLogCalls.some((msg: string) => msg.includes("skills/old.md"))).toBe(true);
      expect(allLogCalls.some((msg: string) => msg.includes("[warning:"))).toBe(true);
    });

    test("displays added components", async () => {
      const diff: StructureDiff = {
        removedComponents: [],
        addedComponents: [{ category: "agents", path: "agents/new.md" }],
        hasStructuralChanges: true,
      };
      mockSelectComponentsWithPrecheck.mockResolvedValueOnce({
        agents: ["agents/new.md"], skills: [], commands: [], mcps: [], rules: [],
      });

      await promptStructuralChanges(
        "@scope/test",
        diff,
        createArtifactInfo(),
        { agents: [], skills: [], commands: [], mcps: [], rules: [] }
      );

      const allLogCalls = mockLog.mock.calls.map((c) => c[0]);
      expect(allLogCalls.some((msg: string) => msg.includes("agents/new.md"))).toBe(true);
      expect(allLogCalls.some((msg: string) => msg.includes("[success:"))).toBe(true);
    });

    test("displays artifact id in header", async () => {
      const diff: StructureDiff = {
        removedComponents: [{ category: "skills", path: "skills/x.md" }],
        addedComponents: [],
        hasStructuralChanges: true,
      };
      mockSelectComponentsWithPrecheck.mockResolvedValueOnce({
        agents: [], skills: [], commands: [], mcps: [], rules: [],
      });

      await promptStructuralChanges(
        "@scope/test",
        diff,
        createArtifactInfo(),
        { agents: [], skills: [], commands: [], mcps: [], rules: [] }
      );

      const allLogCalls = mockLog.mock.calls.map((c) => c[0]);
      expect(allLogCalls.some((msg: string) => msg.includes("@scope/test"))).toBe(true);
    });

    test("delegates to selectComponentsWithPrecheck", async () => {
      const diff: StructureDiff = {
        removedComponents: [],
        addedComponents: [{ category: "rules", path: "rules/r.md" }],
        hasStructuralChanges: true,
      };
      const previousSelection = { agents: [], skills: ["skills/a.md"], commands: [], mcps: [], rules: [] };
      const artifactInfo = createArtifactInfo();
      const expectedResult = { agents: [], skills: ["skills/a.md"], commands: [], mcps: [], rules: ["rules/r.md"] };
      mockSelectComponentsWithPrecheck.mockResolvedValueOnce(expectedResult);

      const result = await promptStructuralChanges("@scope/test", diff, artifactInfo, previousSelection);

      expect(mockSelectComponentsWithPrecheck).toHaveBeenCalledWith(artifactInfo, previousSelection);
      expect(result).toEqual(expectedResult);
    });
  });
});
