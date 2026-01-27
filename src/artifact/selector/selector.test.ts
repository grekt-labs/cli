import { describe, test, expect } from "bun:test";
import { isFullSelection, isEmptySelection, type ComponentSelection } from "./selector";
import type { ArtifactInfo } from "#/context";

describe("selector", () => {
  const createArtifactInfo = (options: {
    hasAgent?: boolean;
    skillCount?: number;
    commandCount?: number;
  }): ArtifactInfo => {
    const info: ArtifactInfo = {
      manifest: {
        name: "test",
        author: "author",
        version: "1.0.0",
        description: "desc",
      },
      skills: [],
      commands: [],
    };

    if (options.hasAgent) {
      info.agent = {
        path: "agent.md",
        parsed: {
          frontmatter: { type: "agent", name: "Agent", description: "desc" },
          content: "content",
        },
      };
    }

    for (let i = 0; i < (options.skillCount || 0); i++) {
      info.skills.push({
        path: `skills/skill${i}.md`,
        parsed: {
          frontmatter: { type: "skill", name: `Skill ${i}`, description: "desc" },
          content: "content",
        },
      });
    }

    for (let i = 0; i < (options.commandCount || 0); i++) {
      info.commands.push({
        path: `commands/cmd${i}.md`,
        parsed: {
          frontmatter: { type: "command", name: `Command ${i}`, description: "desc" },
          content: "content",
        },
      });
    }

    return info;
  };

  describe("isFullSelection", () => {
    test("returns true when all components selected", () => {
      const artifactInfo = createArtifactInfo({
        hasAgent: true,
        skillCount: 2,
        commandCount: 1,
      });
      const selection: ComponentSelection = {
        agent: "agent.md",
        skills: ["skills/skill0.md", "skills/skill1.md"],
        commands: ["commands/cmd0.md"],
      };

      expect(isFullSelection(artifactInfo, selection)).toBe(true);
    });

    test("returns false for partial selection", () => {
      const artifactInfo = createArtifactInfo({
        hasAgent: true,
        skillCount: 2,
      });
      const selection: ComponentSelection = {
        agent: undefined,
        skills: ["skills/skill0.md"],
        commands: [],
      };

      expect(isFullSelection(artifactInfo, selection)).toBe(false);
    });

    test("returns true for empty artifact with empty selection", () => {
      const artifactInfo = createArtifactInfo({});
      const selection: ComponentSelection = {
        agent: undefined,
        skills: [],
        commands: [],
      };

      expect(isFullSelection(artifactInfo, selection)).toBe(true);
    });
  });

  describe("isEmptySelection", () => {
    test("returns true when nothing selected", () => {
      const selection: ComponentSelection = {
        agent: undefined,
        skills: [],
        commands: [],
      };

      expect(isEmptySelection(selection)).toBe(true);
    });

    test("returns false when something selected", () => {
      const selection: ComponentSelection = {
        agent: "agent.md",
        skills: [],
        commands: [],
      };

      expect(isEmptySelection(selection)).toBe(false);
    });

    test("returns false when skills selected", () => {
      const selection: ComponentSelection = {
        agent: undefined,
        skills: ["skills/skill.md"],
        commands: [],
      };

      expect(isEmptySelection(selection)).toBe(false);
    });

    test("returns false when commands selected", () => {
      const selection: ComponentSelection = {
        agent: undefined,
        skills: [],
        commands: ["commands/cmd.md"],
      };

      expect(isEmptySelection(selection)).toBe(false);
    });
  });
});
