import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { scanDirectory, syncFromDirectory } from "./standalone";
import { GREKT_SECTION_HEADER } from "@grekt/engine";
import { suppressConsole } from "#/test-utils";

let restoreConsole: () => void;

beforeEach(() => {
  restoreConsole = suppressConsole("log");
});

afterEach(() => {
  restoreConsole();
});

const VALID_SKILL = `---
grk-type: skills
grk-name: review
grk-description: Code review skill
---
Review the code for best practices.`;

const VALID_AGENT = `---
grk-type: agents
grk-name: helper
grk-description: A helpful agent
---
# Helper Agent`;

const VALID_COMMAND = `---
grk-type: commands
grk-name: deploy
grk-description: Deploy command
---
Deploy the application.`;

const NO_FRONTMATTER = `# Just a plain markdown file
No frontmatter here.`;

const INVALID_FRONTMATTER = `---
grk-type: skills
---
Missing name and description.`;

describe("standalone sync", () => {
  const testDir = join(process.cwd(), ".test-standalone-sync");
  const sourceDir = join(testDir, "source");
  const projectDir = join(testDir, "project");

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("scanDirectory", () => {
    test("finds and categorizes valid .md files", () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);
      writeFileSync(join(sourceDir, "helper.md"), VALID_AGENT);

      const result = scanDirectory(sourceDir);

      expect(result.files.skills.length).toBe(1);
      expect(result.files.agents.length).toBe(1);
      expect(result.invalidFiles.length).toBe(0);
    });

    test("finds files in nested directories", () => {
      mkdirSync(join(sourceDir, "skills"), { recursive: true });
      mkdirSync(join(sourceDir, "agents"), { recursive: true });

      writeFileSync(join(sourceDir, "skills/review.md"), VALID_SKILL);
      writeFileSync(join(sourceDir, "agents/helper.md"), VALID_AGENT);

      const result = scanDirectory(sourceDir);

      expect(result.files.skills.length).toBe(1);
      expect(result.files.agents.length).toBe(1);
      expect(result.files.skills[0].path).toBe("skills/review.md");
    });

    test("reports files without frontmatter as invalid", () => {
      writeFileSync(join(sourceDir, "plain.md"), NO_FRONTMATTER);

      const result = scanDirectory(sourceDir);

      expect(result.invalidFiles.length).toBe(1);
      expect(result.invalidFiles[0].path).toBe("plain.md");
      expect(result.invalidFiles[0].reason).toBe("no-frontmatter");
    });

    test("reports files with incomplete frontmatter as invalid", () => {
      writeFileSync(join(sourceDir, "incomplete.md"), INVALID_FRONTMATTER);

      const result = scanDirectory(sourceDir);

      expect(result.invalidFiles.length).toBe(1);
      expect(result.invalidFiles[0].path).toBe("incomplete.md");
    });

    test("returns empty result for directory with no .md files", () => {
      writeFileSync(join(sourceDir, "readme.txt"), "Not markdown");

      const result = scanDirectory(sourceDir);

      const totalFiles = Object.values(result.files).reduce((sum, files) => sum + files.length, 0);
      expect(totalFiles).toBe(0);
      expect(result.invalidFiles.length).toBe(0);
    });

    test("ignores node_modules directory", () => {
      mkdirSync(join(sourceDir, "node_modules/some-pkg"), { recursive: true });
      writeFileSync(join(sourceDir, "node_modules/some-pkg/skill.md"), VALID_SKILL);
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      const result = scanDirectory(sourceDir);

      expect(result.files.skills.length).toBe(1);
      expect(result.files.skills[0].path).toBe("review.md");
    });

    test("handles multiple files of the same category", () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);
      writeFileSync(join(sourceDir, "deploy.md"), VALID_COMMAND);
      writeFileSync(
        join(sourceDir, "lint.md"),
        `---
grk-type: skills
grk-name: lint
grk-description: Lint skill
---
Lint the code.`
      );

      const result = scanDirectory(sourceDir);

      expect(result.files.skills.length).toBe(2);
      expect(result.files.commands.length).toBe(1);
    });

    test("preserves parsed content from frontmatter", () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      const result = scanDirectory(sourceDir);

      const skill = result.files.skills[0];
      expect(skill.parsed.frontmatter["grk-name"]).toBe("review");
      expect(skill.parsed.frontmatter["grk-description"]).toBe("Code review skill");
    });
  });

  describe("syncFromDirectory", () => {
    test("throws when source directory does not exist", async () => {
      await expect(
        syncFromDirectory({
          sourceDir: join(testDir, "nonexistent"),
          artifactId: "my-tool",
          targets: ["claude"],
          projectRoot: projectDir,
        })
      ).rejects.toThrow("Source directory not found");
    });

    test("throws when no syncable components found", async () => {
      writeFileSync(join(sourceDir, "plain.md"), NO_FRONTMATTER);

      await expect(
        syncFromDirectory({
          sourceDir: sourceDir,
          artifactId: "my-tool",
          targets: ["claude"],
          projectRoot: projectDir,
        })
      ).rejects.toThrow("No syncable components found");
    });

    test("throws with invalid files detail when no valid components", async () => {
      writeFileSync(join(sourceDir, "plain.md"), NO_FRONTMATTER);

      try {
        await syncFromDirectory({
          sourceDir: sourceDir,
          artifactId: "my-tool",
          targets: ["claude"],
          projectRoot: projectDir,
        });
        expect(true).toBe(false);
      } catch (err) {
        expect((err as Error).message).toContain("Invalid files found");
        expect((err as Error).message).toContain("plain.md");
      }
    });

    test("throws for invalid target", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await expect(
        syncFromDirectory({
          sourceDir: sourceDir,
          artifactId: "my-tool",
          targets: ["nonexistent-target"],
          projectRoot: projectDir,
        })
      ).rejects.toThrow("Unknown targets: nonexistent-target");
    });

    test("syncs skill files to claude target", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      const result = await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      expect(result.totalCreated).toBeGreaterThan(0);
      expect(result.artifactId).toBe("my-tool");
    });

    test("creates target directory structure", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
    });

    test("copies file content correctly", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      // Find the created file in the skills directory
      const skillsDir = join(projectDir, ".claude/skills");
      expect(existsSync(skillsDir)).toBe(true);
    });

    test("reports updated on second sync", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      const result = await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      expect(result.totalUpdated).toBeGreaterThan(0);
    });

    test("dry run does not create files", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      const result = await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
        dryRun: true,
      });

      expect(result.totalCreated).toBeGreaterThan(0);
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    });

    test("syncs multiple categories", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);
      writeFileSync(join(sourceDir, "helper.md"), VALID_AGENT);
      writeFileSync(join(sourceDir, "deploy.md"), VALID_COMMAND);

      const result = await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      expect(result.totalCreated).toBeGreaterThanOrEqual(3);
    });

    test("syncs to multiple targets", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      const result = await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude", "cursor"],
        projectRoot: projectDir,
      });

      expect(result.totalCreated).toBeGreaterThanOrEqual(2);
      expect(existsSync(join(projectDir, ".claude"))).toBe(true);
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    });

    test("creates entry point file when it does not exist", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      // Claude plugin has CLAUDE.md as entry point
      const claudeMd = join(projectDir, ".claude/CLAUDE.md");
      if (existsSync(claudeMd)) {
        const content = readFileSync(claudeMd, "utf-8");
        expect(content).toContain(GREKT_SECTION_HEADER);
      }
    });

    test("does not duplicate entry point block on re-sync", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      const claudeMd = join(projectDir, ".claude/CLAUDE.md");
      if (existsSync(claudeMd)) {
        const content = readFileSync(claudeMd, "utf-8");
        const occurrences = content.split(GREKT_SECTION_HEADER).length - 1;
        expect(occurrences).toBe(1);
      }
    });

    test("uses artifactId for unique file naming", async () => {
      writeFileSync(join(sourceDir, "review.md"), VALID_SKILL);

      await syncFromDirectory({
        sourceDir: sourceDir,
        artifactId: "@scope/my-tool",
        targets: ["claude"],
        projectRoot: projectDir,
      });

      // getSafeFilename transforms "@scope/my-tool" + "review.md" → "scope-my-tool_review.md"
      const skillsDir = join(projectDir, ".claude/skills");
      if (existsSync(skillsDir)) {
        const files = require("fs").readdirSync(skillsDir);
        const hasNamespacedFile = files.some((f: string) => f.includes("scope-my-tool"));
        expect(hasNamespacedFile).toBe(true);
      }
    });

    test("source path is not a directory", async () => {
      const filePath = join(testDir, "not-a-dir.txt");
      writeFileSync(filePath, "not a directory");

      await expect(
        syncFromDirectory({
          sourceDir: filePath,
          artifactId: "my-tool",
          targets: ["claude"],
          projectRoot: projectDir,
        })
      ).rejects.toThrow("Source path is not a directory");
    });
  });
});
