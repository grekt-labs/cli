import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { removeUnselectedFiles } from "./component-manager";
import { cleanEmptyDirs } from "#/shared/filesystem/filesystem";
import type { ArtifactInfo } from "#/context";
import { createEmptySelection, type ComponentSelection } from "#/artifact/selector/selector";
import { createCategoryRecord } from "@grekt-labs/cli-engine";

describe("component-manager", () => {
  const testDir = join(process.cwd(), ".test-component-manager");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTestArtifactInfo = (): ArtifactInfo => ({
    manifest: {
      name: "@scope/test",
      version: "1.0.0",
      description: "desc",
    },
    invalidFiles: [],
    ...createCategoryRecord(() => []),
    agents: [
      {
        path: "agent.md",
        parsed: {
          frontmatter: { "grk-type": "agents", "grk-name": "Agent", "grk-description": "desc" },
          content: "content",
        },
      },
    ],
    skills: [
      {
        path: "skills/skill1.md",
        parsed: {
          frontmatter: { "grk-type": "skills", "grk-name": "Skill 1", "grk-description": "desc" },
          content: "content",
        },
      },
      {
        path: "skills/skill2.md",
        parsed: {
          frontmatter: { "grk-type": "skills", "grk-name": "Skill 2", "grk-description": "desc" },
          content: "content",
        },
      },
    ],
    commands: [
      {
        path: "commands/cmd1.md",
        parsed: {
          frontmatter: { "grk-type": "commands", "grk-name": "Cmd 1", "grk-description": "desc" },
          content: "content",
        },
      },
    ],
  });

  describe("removeUnselectedFiles", () => {
    test("removes agent when not selected", () => {
      writeFileSync(join(testDir, "agent.md"), "# Agent");
      mkdirSync(join(testDir, "skills"), { recursive: true });
      writeFileSync(join(testDir, "skills/skill1.md"), "# Skill");
      writeFileSync(join(testDir, "skills/skill2.md"), "# Skill 2");
      mkdirSync(join(testDir, "commands"), { recursive: true });
      writeFileSync(join(testDir, "commands/cmd1.md"), "# Command");

      const artifactInfo = createTestArtifactInfo();
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        agents: [],
        skills: ["skills/skill1.md", "skills/skill2.md"],
        commands: ["commands/cmd1.md"],
      };

      removeUnselectedFiles(testDir, artifactInfo, selection);

      expect(existsSync(join(testDir, "agent.md"))).toBe(false);
    });

    test("removes skills when not selected", () => {
      mkdirSync(join(testDir, "skills"), { recursive: true });
      writeFileSync(join(testDir, "skills/skill1.md"), "# Skill 1");
      writeFileSync(join(testDir, "skills/skill2.md"), "# Skill 2");

      const artifactInfo = createTestArtifactInfo();
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agent.md"],
        skills: ["skills/skill1.md"],
        commands: ["commands/cmd1.md"],
      };

      removeUnselectedFiles(testDir, artifactInfo, selection);

      expect(existsSync(join(testDir, "skills/skill1.md"))).toBe(true);
      expect(existsSync(join(testDir, "skills/skill2.md"))).toBe(false);
    });

    test("keeps selected components", () => {
      writeFileSync(join(testDir, "agent.md"), "# Agent");
      mkdirSync(join(testDir, "skills"), { recursive: true });
      writeFileSync(join(testDir, "skills/skill1.md"), "# Skill 1");
      writeFileSync(join(testDir, "skills/skill2.md"), "# Skill 2");
      mkdirSync(join(testDir, "commands"), { recursive: true });
      writeFileSync(join(testDir, "commands/cmd1.md"), "# Command");

      const artifactInfo = createTestArtifactInfo();
      const selection: ComponentSelection = {
        ...createEmptySelection(),
        agents: ["agent.md"],
        skills: ["skills/skill1.md", "skills/skill2.md"],
        commands: ["commands/cmd1.md"],
      };

      removeUnselectedFiles(testDir, artifactInfo, selection);

      expect(existsSync(join(testDir, "agent.md"))).toBe(true);
      expect(existsSync(join(testDir, "skills/skill1.md"))).toBe(true);
      expect(existsSync(join(testDir, "skills/skill2.md"))).toBe(true);
      expect(existsSync(join(testDir, "commands/cmd1.md"))).toBe(true);
    });
  });

  describe("cleanEmptyDirs", () => {
    test("keeps non-empty directories", () => {
      mkdirSync(join(testDir, "non-empty"), { recursive: true });
      writeFileSync(join(testDir, "non-empty/file.txt"), "content");

      cleanEmptyDirs(testDir);

      expect(existsSync(join(testDir, "non-empty"))).toBe(true);
      expect(existsSync(join(testDir, "non-empty/file.txt"))).toBe(true);
    });
  });
});
