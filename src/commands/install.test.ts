import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { stringify } from "yaml";
import { hashContent } from "@grekt/engine";
import { createMockInquirer } from "#/test-utils";

vi.mock("@inquirer/prompts", () => createMockInquirer());

// Phase 3 requires resolveArtifact — mock it to prevent real network calls in
// the tests that only exercise Phase 2 (toKeep path).
vi.mock("#/artifact/resolver/resolver", () => ({
  resolveArtifact: vi.fn(),
}));

const ARTIFACTS_DIR = ".grekt/artifacts";
const ARTIFACT_ID = "@scope/test-artifact";

const AGENT_CONTENT = `---
grk-type: agents
grk-name: Test Agent
grk-description: A test agent
---
# Agent Content`;

const SKILL_CONTENT = `---
grk-type: skills
grk-name: Test Skill
grk-description: A test skill
---
# Skill Content`;

const MANIFEST_CONTENT = stringify({
  name: ARTIFACT_ID,
  version: "1.0.0",
  description: "Test artifact",
});

/**
 * Build lockfile files map with real content hashes so that verifyIntegrity
 * returns valid = true when the same content is written to disk.
 */
function buildLockfileFiles(includeSkill = true): Record<string, string> {
  const files: Record<string, string> = {
    "grekt.yaml": hashContent(MANIFEST_CONTENT),
    "agent.md": hashContent(AGENT_CONTENT),
  };
  if (includeSkill) {
    files["skills/skill.md"] = hashContent(SKILL_CONTENT);
  }
  return files;
}

describe("install", () => {
  const testDir = join(process.cwd(), ".test-install-command");
  const artifactDir = join(testDir, ARTIFACTS_DIR, ARTIFACT_ID);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(join(testDir, ".."));
    rmSync(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function createArtifactOnDisk(withSkill = true) {
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(join(artifactDir, "grekt.yaml"), MANIFEST_CONTENT);
    writeFileSync(join(artifactDir, "agent.md"), AGENT_CONTENT);
    if (withSkill) {
      mkdirSync(join(artifactDir, "skills"), { recursive: true });
      writeFileSync(join(artifactDir, "skills/skill.md"), SKILL_CONTENT);
    }
  }

  function createLockfile(
    artifactEntry: Record<string, unknown> = {},
    artifactId: string = ARTIFACT_ID
  ) {
    writeFileSync(
      join(testDir, "grekt.lock"),
      stringify({
        version: 1,
        artifacts: {
          [artifactId]: {
            version: "1.0.0",
            integrity: "sha256:placeholder",
            source: artifactId,
            resolved: "https://registry.grekt.com/test/1.0.0.tar.gz",
            mode: "lazy",
            files: buildLockfileFiles(),
            ...artifactEntry,
          },
        },
      })
    );
  }

  function createConfig(artifactEntry: unknown, artifactId: string = ARTIFACT_ID) {
    writeFileSync(
      join(testDir, "grekt.yaml"),
      stringify({ artifacts: { [artifactId]: artifactEntry } })
    );
  }

  // ---------------------------------------------------------------------------
  // Command metadata
  // ---------------------------------------------------------------------------

  test("command has correct name and alias", async () => {
    const { installCommand } = await import("./install");
    expect(installCommand.name()).toBe("install");
    expect(installCommand.alias()).toBe("i");
  });

  // ---------------------------------------------------------------------------
  // Phase 2 (toKeep) — component selection
  //
  // When an artifact is already in the lockfile at the matching version it goes
  // into the "toKeep" bucket. Before this fix, the component selection stored in
  // grekt.yaml was silently ignored and all files remained on disk.
  // ---------------------------------------------------------------------------

  describe("Phase 2 (toKeep) — component selection applied on lockfile artifacts", () => {
    test("removes unselected components when artifact is already installed", async () => {
      // Artifact on disk with BOTH agent and skill files.
      createArtifactOnDisk();
      // Lockfile version matches config → toKeep → integrity valid → "skipped".
      createLockfile();
      // Config requests only the agent component — skill should be pruned.
      createConfig({ version: "1.0.0", agents: ["agent.md"] });

      const { installCommand } = await import("./install");
      await installCommand.parseAsync(["node", "install"]);

      expect(existsSync(join(artifactDir, "agent.md"))).toBe(true);
      expect(existsSync(join(artifactDir, "skills/skill.md"))).toBe(false);
    });

    test("keeps all files when config entry is a plain version string (full install)", async () => {
      createArtifactOnDisk();
      createLockfile();
      // String entry → getConfigSelection returns undefined → nothing removed.
      createConfig("1.0.0");

      const { installCommand } = await import("./install");
      await installCommand.parseAsync(["node", "install"]);

      expect(existsSync(join(artifactDir, "agent.md"))).toBe(true);
      expect(existsSync(join(artifactDir, "skills/skill.md"))).toBe(true);
    });

    test("keeps all files when config entry is an object without category arrays", async () => {
      createArtifactOnDisk();
      createLockfile();
      // Object with version only, no category arrays → no selection.
      createConfig({ version: "1.0.0", mode: "lazy" });

      const { installCommand } = await import("./install");
      await installCommand.parseAsync(["node", "install"]);

      expect(existsSync(join(artifactDir, "agent.md"))).toBe(true);
      expect(existsSync(join(artifactDir, "skills/skill.md"))).toBe(true);
    });

    test("keeps all files when all components are explicitly selected", async () => {
      createArtifactOnDisk();
      createLockfile();
      // All components listed → nothing should be removed.
      createConfig({ version: "1.0.0", agents: ["agent.md"], skills: ["skills/skill.md"] });

      const { installCommand } = await import("./install");
      await installCommand.parseAsync(["node", "install"]);

      expect(existsSync(join(artifactDir, "agent.md"))).toBe(true);
      expect(existsSync(join(artifactDir, "skills/skill.md"))).toBe(true);
    });

    test("selection only affects the artifact that has it, not siblings", async () => {
      const otherArtifactId = "@scope/other-artifact";
      const otherArtifactDir = join(testDir, ARTIFACTS_DIR, otherArtifactId);

      // First artifact has partial selection.
      createArtifactOnDisk();
      createLockfile();

      // Second artifact has no selection and is fully installed.
      mkdirSync(otherArtifactDir, { recursive: true });
      writeFileSync(
        join(otherArtifactDir, "grekt.yaml"),
        stringify({ name: otherArtifactId, version: "1.0.0", description: "other" })
      );
      writeFileSync(join(otherArtifactDir, "agent.md"), AGENT_CONTENT);

      writeFileSync(
        join(testDir, "grekt.lock"),
        stringify({
          version: 1,
          artifacts: {
            [ARTIFACT_ID]: {
              version: "1.0.0",
              integrity: "sha256:placeholder",
              source: ARTIFACT_ID,
              resolved: "https://registry.grekt.com/test/1.0.0.tar.gz",
              mode: "lazy",
              files: buildLockfileFiles(),
            },
            [otherArtifactId]: {
              version: "1.0.0",
              integrity: "sha256:placeholder",
              source: otherArtifactId,
              resolved: "https://registry.grekt.com/other/1.0.0.tar.gz",
              mode: "lazy",
              files: {
                "grekt.yaml": hashContent(
                  stringify({ name: otherArtifactId, version: "1.0.0", description: "other" })
                ),
                "agent.md": hashContent(AGENT_CONTENT),
              },
            },
          },
        })
      );
      writeFileSync(
        join(testDir, "grekt.yaml"),
        stringify({
          artifacts: {
            // first artifact: partial selection (agents only)
            [ARTIFACT_ID]: { version: "1.0.0", agents: ["agent.md"] },
            // second artifact: full install
            [otherArtifactId]: "1.0.0",
          },
        })
      );

      const { installCommand } = await import("./install");
      await installCommand.parseAsync(["node", "install"]);

      // First artifact: skill removed.
      expect(existsSync(join(artifactDir, "skills/skill.md"))).toBe(false);
      expect(existsSync(join(artifactDir, "agent.md"))).toBe(true);

      // Second artifact: untouched.
      expect(existsSync(join(otherArtifactDir, "agent.md"))).toBe(true);
    });
  });
});
