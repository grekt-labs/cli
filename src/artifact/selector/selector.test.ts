import { describe, test, expect } from "bun:test";
import { isFullSelection, isEmptySelection, createEmptySelection, type ComponentSelection } from "./selector";
import type { ArtifactInfo } from "#/context";
import { CATEGORIES, createCategoryRecord } from "@grekt-labs/cli-engine";

describe("selector", () => {
  const createArtifactInfo = (options: {
    agentCount?: number;
    skillCount?: number;
    commandCount?: number;
  }): ArtifactInfo => {
    const info: ArtifactInfo = {
      manifest: {
        name: "@scope/test",
        version: "1.0.0",
        description: "desc",
      },
      invalidFiles: [],
      ...createCategoryRecord(() => []),
    };

    for (let i = 0; i < (options.agentCount || 0); i++) {
      info.agents.push({
        path: `agents/agent${i}.md`,
        parsed: {
          frontmatter: { "grk-type": "agents", "grk-name": `Agent ${i}`, "grk-description": "desc" },
          content: "content",
        },
      });
    }

    for (let i = 0; i < (options.skillCount || 0); i++) {
      info.skills.push({
        path: `skills/skill${i}.md`,
        parsed: {
          frontmatter: { "grk-type": "skills", "grk-name": `Skill ${i}`, "grk-description": "desc" },
          content: "content",
        },
      });
    }

    for (let i = 0; i < (options.commandCount || 0); i++) {
      info.commands.push({
        path: `commands/cmd${i}.md`,
        parsed: {
          frontmatter: { "grk-type": "commands", "grk-name": `Command ${i}`, "grk-description": "desc" },
          content: "content",
        },
      });
    }

    return info;
  };

  describe("isFullSelection", () => {
    test("returns true when all components selected", () => {
      const artifactInfo = createArtifactInfo({
        agentCount: 1,
        skillCount: 2,
        commandCount: 1,
      });
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent0.md"],
        skills: ["skills/skill0.md", "skills/skill1.md"],
        commands: ["commands/cmd0.md"],
      };

      expect(isFullSelection(artifactInfo, selection)).toBe(true);
    });

    test("returns false for partial selection", () => {
      const artifactInfo = createArtifactInfo({
        agentCount: 1,
        skillCount: 2,
      });
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        agents: [],
        skills: ["skills/skill0.md"],
      };

      expect(isFullSelection(artifactInfo, selection)).toBe(false);
    });

    test("returns true for empty artifact with empty selection", () => {
      const artifactInfo = createArtifactInfo({});
      const selection = createEmptySelection();

      expect(isFullSelection(artifactInfo, selection)).toBe(true);
    });
  });

  describe("isEmptySelection", () => {
    test("returns true when nothing selected", () => {
      const selection = createEmptySelection();

      expect(isEmptySelection(selection)).toBe(true);
    });

    test("returns false when agent selected", () => {
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agents/agent.md"],
      };

      expect(isEmptySelection(selection)).toBe(false);
    });

    test("returns false when skills selected", () => {
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        skills: ["skills/skill.md"],
      };

      expect(isEmptySelection(selection)).toBe(false);
    });

    test("returns false when commands selected", () => {
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        commands: ["commands/cmd.md"],
      };

      expect(isEmptySelection(selection)).toBe(false);
    });
  });
});
