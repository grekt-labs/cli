import { describe, test, expect } from "bun:test";
import { getArtifactMode, shouldSyncArtifact, shouldUseSymlinks, isArtifactTrusted } from "./mode";
import type { ProjectConfig, Lockfile } from "@grekt-labs/cli-engine";

const baseConfig: ProjectConfig = {
  targets: [],
  artifacts: {},
  customTargets: {},
};

const baseLockfile: Lockfile = {
  version: 1,
  artifacts: {},
};

describe("getArtifactMode", () => {
  test("returns lazy when no config or lockfile", () => {
    expect(getArtifactMode("@scope/name")).toBe("lazy");
  });

  test("returns lazy for string config entry", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: { "@scope/name": "1.0.0" },
    };
    expect(getArtifactMode("@scope/name", config)).toBe("lazy");
  });

  test("returns mode from config object entry", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core" },
      },
    };
    expect(getArtifactMode("@scope/name", config)).toBe("core");
  });

  test("returns core-sym from config", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core-sym" },
      },
    };
    expect(getArtifactMode("@scope/name", config)).toBe("core-sym");
  });

  test("lockfile mode takes priority over config", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "lazy" },
      },
    };
    const lockfile: Lockfile = {
      ...baseLockfile,
      artifacts: {
        "@scope/name": {
          version: "1.0.0",
          integrity: "sha256:abc",
          mode: "core",
          files: {},
        },
      },
    };
    expect(getArtifactMode("@scope/name", config, lockfile)).toBe("core");
  });

  test("falls back to config when lockfile has no mode", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core-sym" },
      },
    };
    const lockfile: Lockfile = {
      ...baseLockfile,
      artifacts: {
        "@scope/name": {
          version: "1.0.0",
          integrity: "sha256:abc",
          files: {},
        },
      },
    };
    expect(getArtifactMode("@scope/name", config, lockfile)).toBe("core-sym");
  });

  test("returns lazy for unknown artifact", () => {
    expect(getArtifactMode("@scope/unknown", baseConfig, baseLockfile)).toBe("lazy");
  });
});

describe("shouldSyncArtifact", () => {
  test("returns false for lazy mode", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: { "@scope/name": "1.0.0" },
    };
    expect(shouldSyncArtifact("@scope/name", config)).toBe(false);
  });

  test("returns true for core mode", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core" },
      },
    };
    expect(shouldSyncArtifact("@scope/name", config)).toBe(true);
  });

  test("returns true for core-sym mode", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core-sym" },
      },
    };
    expect(shouldSyncArtifact("@scope/name", config)).toBe(true);
  });
});

describe("shouldUseSymlinks", () => {
  test("returns false for core mode", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core" },
      },
    };
    expect(shouldUseSymlinks("@scope/name", config)).toBe(false);
  });

  test("returns true for core-sym mode", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "core-sym" },
      },
    };
    expect(shouldUseSymlinks("@scope/name", config)).toBe(true);
  });

  test("returns false for lazy mode", () => {
    expect(shouldUseSymlinks("@scope/name", baseConfig)).toBe(false);
  });
});

describe("isArtifactTrusted", () => {
  test("returns false when config is undefined", () => {
    expect(isArtifactTrusted("@scope/name")).toBe(false);
  });

  test("returns false when artifact is not in config", () => {
    expect(isArtifactTrusted("@scope/name", baseConfig)).toBe(false);
  });

  test("returns false for string entry (short form)", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: { "@scope/name": "1.0.0" },
    };
    expect(isArtifactTrusted("@scope/name", config)).toBe(false);
  });

  test("returns false when trusted is not set on object entry", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "lazy" },
      },
    };
    expect(isArtifactTrusted("@scope/name", config)).toBe(false);
  });

  test("returns false when trusted is explicitly false", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "lazy", trusted: false },
      },
    };
    expect(isArtifactTrusted("@scope/name", config)).toBe(false);
  });

  test("returns true when trusted is true", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/name": { version: "1.0.0", mode: "lazy", trusted: true },
      },
    };
    expect(isArtifactTrusted("@scope/name", config)).toBe(true);
  });

  test("isolates trusted status between artifacts", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      artifacts: {
        "@scope/safe": { version: "1.0.0", mode: "lazy" },
        "@scope/risky": { version: "1.0.0", mode: "lazy", trusted: true },
      },
    };
    expect(isArtifactTrusted("@scope/safe", config)).toBe(false);
    expect(isArtifactTrusted("@scope/risky", config)).toBe(true);
  });
});
