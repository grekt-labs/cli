import { describe, expect, test } from "vitest";
import { reconcile, extractVersion, extractMode } from "./reconcile";
import type { ProjectConfig, Lockfile, LockfileEntry } from "@grekt-labs/cli-engine";

function makeLockfileEntry(overrides: Partial<LockfileEntry> = {}): LockfileEntry {
  return {
    version: "1.0.0",
    integrity: "sha256:abc123",
    source: "@scope/name",
    resolved: "https://registry.grekt.com/@scope/name/1.0.0.tar.gz",
    mode: "lazy",
    files: { "agents/agent.md": "sha256:def456" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers: extractVersion / extractMode
// ---------------------------------------------------------------------------

describe("extractVersion", () => {
  test("string entry returns the version directly", () => {
    expect(extractVersion("1.0.0")).toBe("1.0.0");
  });

  test("object entry returns .version", () => {
    expect(extractVersion({ version: "2.0.0", mode: "core" })).toBe("2.0.0");
  });

  test("object with category arrays still returns .version", () => {
    expect(
      extractVersion({ version: "3.0.0", mode: "lazy", agents: ["agents/coder.md"] })
    ).toBe("3.0.0");
  });
});

describe("extractMode", () => {
  test("string entry defaults to lazy", () => {
    expect(extractMode("1.0.0")).toBe("lazy");
  });

  test("object entry returns explicit mode", () => {
    expect(extractMode({ version: "1.0.0", mode: "core" })).toBe("core");
    expect(extractMode({ version: "1.0.0", mode: "core-sym" })).toBe("core-sym");
  });

  test("object without mode defaults to lazy", () => {
    expect(extractMode({ version: "1.0.0" })).toBe("lazy");
  });
});

// ---------------------------------------------------------------------------
// Workflow: reconcile
// ---------------------------------------------------------------------------

describe("reconcile", () => {

  // -------------------------------------------------------------------------
  // Workflow: fresh clone (no lockfile)
  // User clones a repo that has grekt.yaml but no grekt.lock.
  // All artifacts must be resolved from scratch.
  // -------------------------------------------------------------------------
  describe("fresh clone — no lockfile, artifacts in config", () => {
    test("all config artifacts go to toResolve", () => {
      const config: ProjectConfig["artifacts"] = {
        "@team/linter": "1.0.0",
        "@team/formatter": "2.1.0",
      };

      const result = reconcile(config, {});

      expect(result.toResolve).toHaveLength(2);
      expect(result.toKeep).toHaveLength(0);
      expect(result.toPrune).toHaveLength(0);
    });

    test("each resolve entry carries the version from config", () => {
      const config: ProjectConfig["artifacts"] = {
        "@team/linter": "1.0.0",
        "@team/formatter": { version: "2.1.0", mode: "core" },
      };

      const result = reconcile(config, {});

      const linter = result.toResolve.find((e) => e.artifactId === "@team/linter")!;
      const formatter = result.toResolve.find((e) => e.artifactId === "@team/formatter")!;

      expect(linter.configVersion).toBe("1.0.0");
      expect(formatter.configVersion).toBe("2.1.0");
    });

    test("source defaults to artifactId when there is no lockfile entry to read from", () => {
      const config: ProjectConfig["artifacts"] = {
        "@team/brand-new": "1.0.0",
      };

      const result = reconcile(config, {});

      expect(result.toResolve[0]!.source).toBe("@team/brand-new");
      expect(result.toResolve[0]!.lockfileEntry).toBeUndefined();
    });

    test("reason explains this is a new artifact", () => {
      const result = reconcile({ "@team/new": "1.0.0" }, {});

      expect(result.toResolve[0]!.reason).toBe("new artifact");
    });
  });

  // -------------------------------------------------------------------------
  // Workflow: clean install (lockfile matches config)
  // grekt.yaml and grekt.lock are in sync. Install uses lockfile entries as-is.
  // -------------------------------------------------------------------------
  describe("clean install — lockfile matches config", () => {
    test("all artifacts go to toKeep when versions match", () => {
      const config: ProjectConfig["artifacts"] = {
        "@team/linter": "1.0.0",
        "@team/formatter": "2.0.0",
      };
      const lock: Lockfile["artifacts"] = {
        "@team/linter": makeLockfileEntry({ version: "1.0.0" }),
        "@team/formatter": makeLockfileEntry({ version: "2.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep).toHaveLength(2);
      expect(result.toResolve).toHaveLength(0);
      expect(result.toPrune).toHaveLength(0);
    });

    test("toKeep entries hold the same lockfile object reference (install mutates mode)", () => {
      const lockEntry = makeLockfileEntry({ version: "1.0.0" });
      const config: ProjectConfig["artifacts"] = { "@team/linter": "1.0.0" };
      const lock: Lockfile["artifacts"] = { "@team/linter": lockEntry };

      const result = reconcile(config, lock);

      expect(result.toKeep[0]!.lockfileEntry).toBe(lockEntry);
    });

    test("string and object config entries both match when version is equal", () => {
      const config: ProjectConfig["artifacts"] = {
        "@scope/simple": "1.0.0",
        "@scope/detailed": { version: "1.0.0", mode: "core", agents: ["agents/x.md"] },
      };
      const lock: Lockfile["artifacts"] = {
        "@scope/simple": makeLockfileEntry({ version: "1.0.0" }),
        "@scope/detailed": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep).toHaveLength(2);
      expect(result.toResolve).toHaveLength(0);
    });

    test("partial component selection in config does not affect reconciliation", () => {
      const config: ProjectConfig["artifacts"] = {
        "@scope/partial": {
          version: "1.0.0",
          mode: "lazy",
          agents: ["agents/coder.md"],
        },
      };
      const lock: Lockfile["artifacts"] = {
        "@scope/partial": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep).toHaveLength(1);
      expect(result.toResolve).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Workflow: version changed in config
  // User edits grekt.yaml to bump (or downgrade) a version.
  // Install must re-resolve from source.
  // -------------------------------------------------------------------------
  describe("version changed in config — re-resolve from source", () => {
    test("upgrade: config version > lockfile version triggers resolve", () => {
      const config: ProjectConfig["artifacts"] = { "@team/linter": "2.0.0" };
      const lock: Lockfile["artifacts"] = {
        "@team/linter": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toResolve).toHaveLength(1);
      expect(result.toResolve[0]!.configVersion).toBe("2.0.0");
    });

    test("downgrade: config version < lockfile version also triggers resolve", () => {
      const config: ProjectConfig["artifacts"] = { "@team/linter": "0.5.0" };
      const lock: Lockfile["artifacts"] = {
        "@team/linter": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toResolve).toHaveLength(1);
      expect(result.toResolve[0]!.configVersion).toBe("0.5.0");
    });

    test("reason describes the version transition", () => {
      const config: ProjectConfig["artifacts"] = { "@team/linter": "3.0.0" };
      const lock: Lockfile["artifacts"] = {
        "@team/linter": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toResolve[0]!.reason).toBe("version changed 1.0.0 → 3.0.0");
    });

    test("uses lockfile source for re-resolution (not the artifactId)", () => {
      const config: ProjectConfig["artifacts"] = { "@team/linter": "2.0.0" };
      const lock: Lockfile["artifacts"] = {
        "@team/linter": makeLockfileEntry({
          version: "1.0.0",
          source: "github:team/linter-rules",
        }),
      };

      const result = reconcile(config, lock);

      expect(result.toResolve[0]!.source).toBe("github:team/linter-rules");
    });

    test("previous lockfile entry is preserved in resolve result for reference", () => {
      const existingEntry = makeLockfileEntry({ version: "1.0.0" });
      const config: ProjectConfig["artifacts"] = { "@team/linter": "2.0.0" };
      const lock: Lockfile["artifacts"] = { "@team/linter": existingEntry };

      const result = reconcile(config, lock);

      expect(result.toResolve[0]!.lockfileEntry).toBe(existingEntry);
    });
  });

  // -------------------------------------------------------------------------
  // Workflow: artifact added to config
  // User adds a new entry to grekt.yaml manually.
  // Install must resolve it (same as fresh clone for that artifact).
  // -------------------------------------------------------------------------
  describe("artifact added to config — resolve new entry", () => {
    test("new artifact goes to toResolve, existing stays in toKeep", () => {
      const config: ProjectConfig["artifacts"] = {
        "@team/existing": "1.0.0",
        "@team/new-tool": "1.0.0",
      };
      const lock: Lockfile["artifacts"] = {
        "@team/existing": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep).toHaveLength(1);
      expect(result.toKeep[0]!.artifactId).toBe("@team/existing");

      expect(result.toResolve).toHaveLength(1);
      expect(result.toResolve[0]!.artifactId).toBe("@team/new-tool");
      expect(result.toResolve[0]!.reason).toBe("new artifact");
    });
  });

  // -------------------------------------------------------------------------
  // Workflow: artifact removed from config (prune)
  // User deletes an entry from grekt.yaml.
  // Install must remove it from lockfile and disk.
  // -------------------------------------------------------------------------
  describe("artifact removed from config — prune from lockfile and disk", () => {
    test("lockfile-only artifact goes to toPrune", () => {
      const config: ProjectConfig["artifacts"] = {};
      const lock: Lockfile["artifacts"] = {
        "@team/removed": makeLockfileEntry({ version: "1.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toPrune).toHaveLength(1);
      expect(result.toPrune[0]!.artifactId).toBe("@team/removed");
      expect(result.toPrune[0]!.reason).toBe("removed from config");
    });

    test("prune entry preserves full lockfile entry (install needs files for cleanup)", () => {
      const lockEntry = makeLockfileEntry({
        version: "1.0.0",
        files: { "agents/a.md": "sha256:aaa", "skills/b.md": "sha256:bbb" },
      });

      const result = reconcile({}, { "@team/old": lockEntry });

      expect(result.toPrune[0]!.lockfileEntry).toBe(lockEntry);
      expect(result.toPrune[0]!.lockfileEntry!.files).toEqual({
        "agents/a.md": "sha256:aaa",
        "skills/b.md": "sha256:bbb",
      });
    });

    test("multiple removals at once all land in toPrune", () => {
      const config: ProjectConfig["artifacts"] = {};
      const lock: Lockfile["artifacts"] = {
        "@team/one": makeLockfileEntry({ version: "1.0.0" }),
        "@team/two": makeLockfileEntry({ version: "2.0.0" }),
        "@team/three": makeLockfileEntry({ version: "3.0.0" }),
      };

      const result = reconcile(config, lock);

      expect(result.toPrune).toHaveLength(3);
      expect(result.toKeep).toHaveLength(0);
      expect(result.toResolve).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Workflow: empty config
  // User has grekt.yaml but no artifacts listed.
  // -------------------------------------------------------------------------
  describe("no artifacts in config", () => {
    test("empty config + empty lockfile produces nothing", () => {
      const result = reconcile({}, {});

      expect(result.toKeep).toHaveLength(0);
      expect(result.toResolve).toHaveLength(0);
      expect(result.toPrune).toHaveLength(0);
    });

    test("empty config + populated lockfile prunes everything", () => {
      const lock: Lockfile["artifacts"] = {
        "@team/a": makeLockfileEntry({ version: "1.0.0" }),
        "@team/b": makeLockfileEntry({ version: "2.0.0" }),
      };

      const result = reconcile({}, lock);

      expect(result.toPrune).toHaveLength(2);
      expect(result.toKeep).toHaveLength(0);
      expect(result.toResolve).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Workflow: real-world mixed scenario
  // Config has changes across all three buckets simultaneously.
  // -------------------------------------------------------------------------
  describe("mixed: keep + resolve + prune in a single reconciliation", () => {
    test("each artifact lands in the correct bucket", () => {
      const config: ProjectConfig["artifacts"] = {
        "@team/stable":  "1.0.0",                                      // same version → keep
        "@team/bumped":  "2.0.0",                                      // was 1.0.0 → resolve
        "@team/new-one": { version: "1.0.0", mode: "core" },           // not in lock → resolve
        // @team/dropped is NOT in config anymore                       // → prune
      };
      const lock: Lockfile["artifacts"] = {
        "@team/stable":  makeLockfileEntry({ version: "1.0.0" }),
        "@team/bumped":  makeLockfileEntry({ version: "1.0.0", source: "github:team/bumped" }),
        "@team/dropped": makeLockfileEntry({ version: "3.0.0" }),
      };

      const result = reconcile(config, lock);

      // Keep
      expect(result.toKeep).toHaveLength(1);
      expect(result.toKeep[0]!.artifactId).toBe("@team/stable");

      // Resolve
      expect(result.toResolve).toHaveLength(2);
      const resolveIds = result.toResolve.map((e) => e.artifactId).sort();
      expect(resolveIds).toEqual(["@team/bumped", "@team/new-one"]);

      // The bumped one should use the lockfile source (github), not the artifactId
      const bumped = result.toResolve.find((e) => e.artifactId === "@team/bumped")!;
      expect(bumped.source).toBe("github:team/bumped");
      expect(bumped.reason).toBe("version changed 1.0.0 → 2.0.0");

      // The new one has no lockfile entry
      const newOne = result.toResolve.find((e) => e.artifactId === "@team/new-one")!;
      expect(newOne.lockfileEntry).toBeUndefined();
      expect(newOne.reason).toBe("new artifact");

      // Prune
      expect(result.toPrune).toHaveLength(1);
      expect(result.toPrune[0]!.artifactId).toBe("@team/dropped");
    });
  });

  // -------------------------------------------------------------------------
  // Source resolution: where to download from
  // -------------------------------------------------------------------------
  describe("source resolution for different origins", () => {
    test("keep entry inherits source from lockfile (preserves github origin)", () => {
      const config: ProjectConfig["artifacts"] = { "@scope/tool": "1.0.0" };
      const lock: Lockfile["artifacts"] = {
        "@scope/tool": makeLockfileEntry({ version: "1.0.0", source: "github:org/tool" }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep[0]!.source).toBe("github:org/tool");
    });

    test("keep entry inherits source from lockfile (preserves gitlab origin)", () => {
      const config: ProjectConfig["artifacts"] = { "@scope/tool": "1.0.0" };
      const lock: Lockfile["artifacts"] = {
        "@scope/tool": makeLockfileEntry({ version: "1.0.0", source: "gitlab:host/org/tool" }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep[0]!.source).toBe("gitlab:host/org/tool");
    });

    test("lockfile entry without source field falls back to artifactId", () => {
      const config: ProjectConfig["artifacts"] = { "@scope/tool": "1.0.0" };
      const lock: Lockfile["artifacts"] = {
        "@scope/tool": makeLockfileEntry({ version: "1.0.0", source: undefined }),
      };

      const result = reconcile(config, lock);

      expect(result.toKeep[0]!.source).toBe("@scope/tool");
    });

    test("prune entry without source field falls back to artifactId", () => {
      const lock: Lockfile["artifacts"] = {
        "@scope/gone": makeLockfileEntry({ version: "1.0.0", source: undefined }),
      };

      const result = reconcile({}, lock);

      expect(result.toPrune[0]!.source).toBe("@scope/gone");
    });
  });
});
