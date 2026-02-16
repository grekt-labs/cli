import { describe, test, expect } from "bun:test";
import { createCategoryRecord } from "@grekt-labs/cli-engine";
import type { ArtifactInfo } from "#/context";
import { createEmptySelection, type ComponentSelection } from "#/artifact/selector/selector";
import {
  getPreviousInstallation,
  computeStructureDiff,
  buildSelectionFromPrevious,
  isRegistrySource,
} from "./upgrade";

describe("upgrade", () => {
  /**
   * Helper to build a minimal ArtifactInfo for testing.
   */
  function createArtifactInfo(components: {
    agents?: string[];
    skills?: string[];
    commands?: string[];
    rules?: string[];
    mcps?: string[];
  }): ArtifactInfo {
    const info: ArtifactInfo = {
      manifest: {
        name: "@scope/test",
        version: "2.0.0",
        description: "test artifact",
      },
      invalidFiles: [],
      ...createCategoryRecord(() => []),
    };

    for (const [category, paths] of Object.entries(components)) {
      for (const path of paths) {
        (info as Record<string, unknown[]>)[category].push({
          path,
          parsed: {
            frontmatter: {
              "grk-type": category,
              "grk-name": path,
              "grk-description": "desc",
            },
            content: "content",
          },
        });
      }
    }

    return info;
  }

  describe("getPreviousInstallation", () => {
    test("returns null for missing artifact", () => {
      const config = {
        artifacts: {},
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/missing", config);
      expect(result).toBeNull();
    });

    test("returns full mode for string entry", () => {
      const config = {
        artifacts: { "@scope/test": "1.0.0" },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).toEqual({
        version: "1.0.0",
        mode: "full",
        isCore: false,
        artifactMode: "lazy",
      });
    });

    test("returns full mode for object without category arrays", () => {
      const config = {
        artifacts: {
          "@scope/test": { version: "1.0.0", mode: "lazy" as const },
        },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).toEqual({
        version: "1.0.0",
        mode: "full",
        isCore: false,
        artifactMode: "lazy",
      });
    });

    test("returns partial mode for object with category arrays", () => {
      const config = {
        artifacts: {
          "@scope/test": {
            version: "1.0.0",
            mode: "lazy" as const,
            agents: ["agents/agent1.md"],
            skills: ["skills/skill1.md"],
          },
        },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).not.toBeNull();
      expect(result!.mode).toBe("partial");
      expect(result!.version).toBe("1.0.0");
      expect(result!.isCore).toBe(false);
      expect(result!.selection?.agents).toEqual(["agents/agent1.md"]);
      expect(result!.selection?.skills).toEqual(["skills/skill1.md"]);
    });

    test("returns isCore true for core mode", () => {
      const config = {
        artifacts: {
          "@scope/test": {
            version: "1.0.0",
            mode: "core" as const,
            agents: ["agents/agent1.md"],
          },
        },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).not.toBeNull();
      expect(result!.isCore).toBe(true);
      expect(result!.artifactMode).toBe("core");
    });

    test("returns isCore true and artifactMode for core-sym mode", () => {
      const config = {
        artifacts: {
          "@scope/test": {
            version: "1.0.0",
            mode: "core-sym" as const,
          },
        },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).not.toBeNull();
      expect(result!.isCore).toBe(true);
      expect(result!.artifactMode).toBe("core-sym");
    });

    test("returns artifactMode lazy for string entry", () => {
      const config = {
        artifacts: { "@scope/test": "1.0.0" },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).not.toBeNull();
      expect(result!.artifactMode).toBe("lazy");
    });

    test("sanitizes unknown mode to lazy", () => {
      const config = {
        artifacts: {
          "@scope/test": {
            version: "1.0.0",
            // Force an invalid mode past TypeScript for testing runtime sanitization
            mode: "malicious" as unknown as "core",
          },
        },
        targets: [],
        customTargets: {},
      };

      const result = getPreviousInstallation("@scope/test", config);
      expect(result).not.toBeNull();
      expect(result!.isCore).toBe(false);
      expect(result!.artifactMode).toBe("lazy");
    });
  });

  describe("computeStructureDiff", () => {
    test("returns no changes when selection matches new artifact", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md"],
        skills: ["skills/skill1.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md"],
        skills: ["skills/skill1.md", "skills/skill2.md"],
      });

      const diff = computeStructureDiff(previousSelection, newArtifactInfo);
      expect(diff.hasStructuralChanges).toBe(true);
      expect(diff.removedComponents).toEqual([]);
      expect(diff.addedComponents).toEqual([
        { category: "skills", path: "skills/skill2.md" },
      ]);
    });

    test("detects removed components", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md", "agents/agent2.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md"],
      });

      const diff = computeStructureDiff(previousSelection, newArtifactInfo);
      expect(diff.hasStructuralChanges).toBe(true);
      expect(diff.removedComponents).toEqual([
        { category: "agents", path: "agents/agent2.md" },
      ]);
    });

    test("detects added components", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md", "agents/agent2.md"],
      });

      const diff = computeStructureDiff(previousSelection, newArtifactInfo);
      expect(diff.hasStructuralChanges).toBe(true);
      expect(diff.addedComponents).toEqual([
        { category: "agents", path: "agents/agent2.md" },
      ]);
    });

    test("detects both removed and added components", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/old-agent.md"],
        skills: ["skills/kept.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/new-agent.md"],
        skills: ["skills/kept.md"],
      });

      const diff = computeStructureDiff(previousSelection, newArtifactInfo);
      expect(diff.hasStructuralChanges).toBe(true);
      expect(diff.removedComponents).toEqual([
        { category: "agents", path: "agents/old-agent.md" },
      ]);
      expect(diff.addedComponents).toEqual([
        { category: "agents", path: "agents/new-agent.md" },
      ]);
    });

    test("returns no changes when structure is identical", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md"],
        skills: ["skills/skill1.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md"],
        skills: ["skills/skill1.md"],
      });

      const diff = computeStructureDiff(previousSelection, newArtifactInfo);
      expect(diff.hasStructuralChanges).toBe(false);
      expect(diff.removedComponents).toEqual([]);
      expect(diff.addedComponents).toEqual([]);
    });

    test("handles multi-category changes", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md"],
        skills: ["skills/old-skill.md"],
        commands: ["commands/cmd1.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md", "agents/agent2.md"],
        skills: ["skills/new-skill.md"],
        commands: ["commands/cmd1.md"],
      });

      const diff = computeStructureDiff(previousSelection, newArtifactInfo);
      expect(diff.hasStructuralChanges).toBe(true);
      expect(diff.removedComponents).toContainEqual({
        category: "skills",
        path: "skills/old-skill.md",
      });
      expect(diff.addedComponents).toContainEqual({
        category: "agents",
        path: "agents/agent2.md",
      });
      expect(diff.addedComponents).toContainEqual({
        category: "skills",
        path: "skills/new-skill.md",
      });
    });
  });

  describe("buildSelectionFromPrevious", () => {
    test("keeps all paths that still exist", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md"],
        skills: ["skills/skill1.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md"],
        skills: ["skills/skill1.md", "skills/skill2.md"],
      });

      const result = buildSelectionFromPrevious(previousSelection, newArtifactInfo);
      expect(result.agents).toEqual(["agents/agent1.md"]);
      expect(result.skills).toEqual(["skills/skill1.md"]);
    });

    test("drops paths that no longer exist", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent1.md", "agents/removed.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/agent1.md"],
      });

      const result = buildSelectionFromPrevious(previousSelection, newArtifactInfo);
      expect(result.agents).toEqual(["agents/agent1.md"]);
    });

    test("returns empty selection when all previous paths removed", () => {
      const previousSelection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/removed1.md", "agents/removed2.md"],
      };

      const newArtifactInfo = createArtifactInfo({
        agents: ["agents/new-agent.md"],
      });

      const result = buildSelectionFromPrevious(previousSelection, newArtifactInfo);
      expect(result.agents).toEqual([]);
    });
  });

  describe("isRegistrySource", () => {
    test("returns true for registry source", () => {
      const entry = {
        version: "1.0.0",
        integrity: "sha256:abc",
        source: "@scope/artifact",
        mode: "lazy" as const,
        files: {},
      };

      expect(isRegistrySource(entry)).toBe(true);
    });

    test("returns false for github source", () => {
      const entry = {
        version: "1.0.0",
        integrity: "sha256:abc",
        source: "github:user/repo",
        mode: "lazy" as const,
        files: {},
      };

      expect(isRegistrySource(entry)).toBe(false);
    });

    test("returns false for gitlab source", () => {
      const entry = {
        version: "1.0.0",
        integrity: "sha256:abc",
        source: "gitlab:user/repo",
        mode: "lazy" as const,
        files: {},
      };

      expect(isRegistrySource(entry)).toBe(false);
    });

    test("returns true for empty source", () => {
      const entry = {
        version: "1.0.0",
        integrity: "sha256:abc",
        mode: "lazy" as const,
        files: {},
      };

      expect(isRegistrySource(entry)).toBe(true);
    });
  });
});
