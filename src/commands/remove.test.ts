import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { parse, stringify } from "yaml";

const ARTIFACTS_DIR = ".grekt/artifacts";
const TEST_ARTIFACT_ID = "@scope/test-artifact";

// Mock all @inquirer/prompts exports used across the codebase
mock.module("@inquirer/prompts", () => ({
  confirm: () => Promise.resolve(true),
  checkbox: () => Promise.resolve([]),
  input: () => Promise.resolve(""),
  password: () => Promise.resolve(""),
  select: () => Promise.resolve(""),
}));

describe("remove", () => {
  const testDir = join(process.cwd(), ".test-remove-command");
  const artifactDir = join(testDir, ARTIFACTS_DIR, TEST_ARTIFACT_ID);

  function createArtifactFiles() {
    mkdirSync(artifactDir, { recursive: true });

    // Create artifact manifest
    writeFileSync(
      join(artifactDir, "grekt.yaml"),
      stringify({
        name: TEST_ARTIFACT_ID,
        version: "1.0.0",
        description: "Test artifact",
      })
    );

    // Create agent file with valid frontmatter
    writeFileSync(
      join(artifactDir, "agent.md"),
      `---
grk-type: agents
grk-name: Test Agent
grk-description: A test agent
---
# Agent Content`
    );

    // Create skill file with valid frontmatter
    writeFileSync(
      join(artifactDir, "skill.md"),
      `---
grk-type: skills
grk-name: Test Skill
grk-description: A test skill
---
# Skill Content`
    );
  }

  function createProjectConfig(targets: string[] = [], customTargets: Record<string, unknown> = {}) {
    const config = {
      targets,
      artifacts: {
        [TEST_ARTIFACT_ID]: {
          version: "1.0.0",
          mode: "core",
        },
      },
      customTargets,
    };
    writeFileSync(join(testDir, "grekt.yaml"), stringify(config));
  }

  function createLockfile() {
    const lockfile = {
      version: 1,
      artifacts: {
        [TEST_ARTIFACT_ID]: {
          version: "1.0.0",
          integrity: "sha256:abc123",
          mode: "core",
          files: {
            "agent.md": "sha256:def456",
            "skill.md": "sha256:ghi789",
          },
        },
      },
    };
    writeFileSync(join(testDir, "grekt.lock"), stringify(lockfile));
  }

  function createSyncedFiles(targetDir: string) {
    const agentsDir = join(testDir, targetDir, "agents");
    const skillsDir = join(testDir, targetDir, "skills");

    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });

    // Create synced files with safe names (matching getSafeFilename output)
    writeFileSync(join(agentsDir, "scope-test-artifact_agent.md"), "# Synced Agent");
    writeFileSync(join(skillsDir, "scope-test-artifact_skill.md"), "# Synced Skill");
  }

  function createClaudeSyncedFiles() {
    const agentsDir = join(testDir, ".claude", "agents");
    const skillFolderDir = join(testDir, ".claude", "skills", "scope-test-artifact-skill");

    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(skillFolderDir, { recursive: true });

    // Claude uses flat files for agents but folder-based paths for skills
    writeFileSync(join(agentsDir, "scope-test-artifact_agent.md"), "# Synced Agent");
    writeFileSync(join(skillFolderDir, "SKILL.md"), "# Synced Skill");
  }

  function createGrektDir() {
    mkdirSync(join(testDir, ".grekt"), { recursive: true });
    writeFileSync(join(testDir, ".grekt/index"), "");
  }

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Return to original directory
    process.chdir(join(testDir, ".."));
    rmSync(testDir, { recursive: true, force: true });
  });

  test("module can be imported", async () => {
    const module = await import("./remove");
    expect(module).toBeDefined();
    expect(module.removeCommand).toBeDefined();
  });

  test("command has correct name and description", async () => {
    const { removeCommand } = await import("./remove");
    expect(removeCommand.name()).toBe("remove");
    expect(removeCommand.alias()).toBe("rm");
  });

  test("removes artifact directory from .grekt/artifacts", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");

    expect(existsSync(artifactDir)).toBe(true);

    // Import fresh to avoid module caching issues
    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(artifactDir)).toBe(false);
  });

  test("removes synced files from claude target", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");

    const agentPath = join(testDir, ".claude/agents/scope-test-artifact_agent.md");
    const skillPath = join(testDir, ".claude/skills/scope-test-artifact_skill.md");

    expect(existsSync(agentPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(agentPath)).toBe(false);
    expect(existsSync(skillPath)).toBe(false);
  });

  test("removes claude skill folders (folder-based target path)", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createClaudeSyncedFiles();

    const agentPath = join(testDir, ".claude/agents/scope-test-artifact_agent.md");
    const skillFolder = join(testDir, ".claude/skills/scope-test-artifact-skill");
    const skillPath = join(skillFolder, "SKILL.md");

    expect(existsSync(agentPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(agentPath)).toBe(false);
    expect(existsSync(skillPath)).toBe(false);
    // Skill folder should also be cleaned up
    expect(existsSync(skillFolder)).toBe(false);
  });

  test("removes synced files from multiple targets", async () => {
    createArtifactFiles();
    createProjectConfig(["claude", "opencode"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");
    createSyncedFiles(".opencode");

    const claudeAgent = join(testDir, ".claude/agents/scope-test-artifact_agent.md");
    const opencodeAgent = join(testDir, ".opencode/agents/scope-test-artifact_agent.md");

    expect(existsSync(claudeAgent)).toBe(true);
    expect(existsSync(opencodeAgent)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(claudeAgent)).toBe(false);
    expect(existsSync(opencodeAgent)).toBe(false);
  });

  test("removes synced files from custom targets", async () => {
    createArtifactFiles();
    // Custom targets are included via Object.keys(config.customTargets)
    // so they don't need to be in targets array
    createProjectConfig([], {
      myai: {
        name: "My AI",
        contextEntryPoint: ".myai/CONTEXT.md",
      },
    });
    createLockfile();
    createGrektDir();
    createSyncedFiles("myai"); // Custom target uses its ID as base dir

    const customAgent = join(testDir, "myai/agents/scope-test-artifact_agent.md");
    expect(existsSync(customAgent)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(customAgent)).toBe(false);
  });

  test("updates grekt.yaml to remove artifact entry", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");

    const configBefore = parse(readFileSync(join(testDir, "grekt.yaml"), "utf-8"));
    expect(configBefore.artifacts[TEST_ARTIFACT_ID]).toBeDefined();

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    const configAfter = parse(readFileSync(join(testDir, "grekt.yaml"), "utf-8"));
    expect(configAfter.artifacts[TEST_ARTIFACT_ID]).toBeUndefined();
  });

  test("updates grekt.lock to remove artifact entry", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");

    const lockBefore = parse(readFileSync(join(testDir, "grekt.lock"), "utf-8"));
    expect(lockBefore.artifacts[TEST_ARTIFACT_ID]).toBeDefined();

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    const lockAfter = parse(readFileSync(join(testDir, "grekt.lock"), "utf-8"));
    expect(lockAfter.artifacts[TEST_ARTIFACT_ID]).toBeUndefined();
  });

  test("cleans up empty category directories", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");

    const agentsDir = join(testDir, ".claude/agents");
    expect(existsSync(agentsDir)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    // Directory should be removed if empty
    expect(existsSync(agentsDir)).toBe(false);
  });

  test("preserves other files in category directories", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    createSyncedFiles(".claude");

    // Add another file that should not be removed
    const otherFile = join(testDir, ".claude/agents/other-artifact_agent.md");
    writeFileSync(otherFile, "# Other Agent");

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    // Other file should still exist
    expect(existsSync(otherFile)).toBe(true);
    // Directory should not be removed since it's not empty
    expect(existsSync(join(testDir, ".claude/agents"))).toBe(true);
  });

  test("handles artifact without synced files gracefully", async () => {
    createArtifactFiles();
    createProjectConfig(["claude"]);
    createLockfile();
    createGrektDir();
    // Don't create synced files

    expect(existsSync(artifactDir)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(artifactDir)).toBe(false);
  });

  test("handles no configured targets gracefully", async () => {
    createArtifactFiles();
    createProjectConfig([]); // No targets
    createLockfile();
    createGrektDir();

    expect(existsSync(artifactDir)).toBe(true);

    const { removeCommand } = await import("./remove");
    await removeCommand.parseAsync(["node", "remove", TEST_ARTIFACT_ID, "-f"]);

    expect(existsSync(artifactDir)).toBe(false);
  });
});
