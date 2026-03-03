import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { stringify } from "yaml";
import type { WorkspaceArtifact } from "@grekt-labs/cli-engine";

describe("workspace", () => {
  test("module exports all functions", async () => {
    const module = await import("./workspace");
    expect(module.loadWorkspace).toBeDefined();
    expect(module.generateWorkspaceFile).toBeDefined();
    expect(module.cleanWorkspaceFile).toBeDefined();
    expect(module.generatePackageJsonFiles).toBeDefined();
    expect(module.syncVersionsToManifest).toBeDefined();
    expect(module.cleanPackageJsonFiles).toBeDefined();
  });

  test("command module re-exports from domain module", async () => {
    const domain = await import("./workspace");
    const command = await import("#/commands/workspace");

    expect(command.loadWorkspace).toBe(domain.loadWorkspace);
    expect(command.generateWorkspaceFile).toBe(domain.generateWorkspaceFile);
    expect(command.cleanWorkspaceFile).toBe(domain.cleanWorkspaceFile);
    expect(command.generatePackageJsonFiles).toBe(domain.generatePackageJsonFiles);
    expect(command.syncVersionsToManifest).toBe(domain.syncVersionsToManifest);
    expect(command.cleanPackageJsonFiles).toBe(domain.cleanPackageJsonFiles);
  });
});

describe("generateWorkspaceFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grekt-test-workspace-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeArtifacts(...entries: Array<{ name: string; version: string; relativePath: string }>): WorkspaceArtifact[] {
    return entries.map((entry) => ({
      path: join(tempDir, entry.relativePath),
      relativePath: entry.relativePath,
      manifest: {
        name: entry.name,
        version: entry.version,
        description: "test",
        components: { skills: [], agents: [], commands: [] },
      },
    }));
  }

  test("creates pnpm-workspace.yaml with artifact paths", async () => {
    const { generateWorkspaceFile } = await import("./workspace");
    const artifacts = makeArtifacts(
      { name: "@test/alpha", version: "1.0.0", relativePath: "packages/alpha" },
      { name: "@test/beta", version: "2.0.0", relativePath: "packages/beta" },
    );

    generateWorkspaceFile(tempDir, artifacts);

    const content = readFileSync(join(tempDir, "pnpm-workspace.yaml"), "utf-8");
    expect(content).toContain("packages/alpha");
    expect(content).toContain("packages/beta");
  });

  test("creates root package.json with private flag", async () => {
    const { generateWorkspaceFile } = await import("./workspace");
    const artifacts = makeArtifacts(
      { name: "@test/alpha", version: "1.0.0", relativePath: "packages/alpha" },
    );

    generateWorkspaceFile(tempDir, artifacts);

    const content = JSON.parse(readFileSync(join(tempDir, "package.json"), "utf-8"));
    expect(content.name).toBe("workspace-root");
    expect(content.private).toBe(true);
  });
});

describe("cleanWorkspaceFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grekt-test-workspace-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("removes pnpm-workspace.yaml and root package.json", async () => {
    const { cleanWorkspaceFile } = await import("./workspace");

    writeFileSync(join(tempDir, "pnpm-workspace.yaml"), "packages: []");
    writeFileSync(join(tempDir, "package.json"), "{}");

    cleanWorkspaceFile(tempDir);

    expect(existsSync(join(tempDir, "pnpm-workspace.yaml"))).toBe(false);
    expect(existsSync(join(tempDir, "package.json"))).toBe(false);
  });

  test("does not throw when files do not exist", async () => {
    const { cleanWorkspaceFile } = await import("./workspace");

    expect(() => cleanWorkspaceFile(tempDir)).not.toThrow();
  });
});

describe("generatePackageJsonFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grekt-test-workspace-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeArtifact(name: string, version: string, relativePath: string): WorkspaceArtifact {
    const artifactPath = join(tempDir, relativePath);
    mkdirSync(artifactPath, { recursive: true });
    return {
      path: artifactPath,
      relativePath,
      manifest: {
        name,
        version,
        description: "test",
        components: { skills: [], agents: [], commands: [] },
      },
    };
  }

  test("creates package.json in each artifact directory", async () => {
    const { generatePackageJsonFiles } = await import("./workspace");
    const artifacts = [
      makeArtifact("@test/alpha", "1.0.0", "packages/alpha"),
      makeArtifact("@test/beta", "2.3.0", "packages/beta"),
    ];

    generatePackageJsonFiles(artifacts);

    const alphaPackage = JSON.parse(readFileSync(join(tempDir, "packages/alpha/package.json"), "utf-8"));
    expect(alphaPackage.name).toBe("@test/alpha");
    expect(alphaPackage.version).toBe("1.0.0");
    expect(alphaPackage.private).toBe(true);

    const betaPackage = JSON.parse(readFileSync(join(tempDir, "packages/beta/package.json"), "utf-8"));
    expect(betaPackage.name).toBe("@test/beta");
    expect(betaPackage.version).toBe("2.3.0");
  });
});

describe("syncVersionsToManifest", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grekt-test-workspace-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function setupArtifact(name: string, version: string, relativePath: string): WorkspaceArtifact {
    const artifactPath = join(tempDir, relativePath);
    mkdirSync(artifactPath, { recursive: true });

    writeFileSync(
      join(artifactPath, "grekt.yaml"),
      stringify({ name, version, description: "test", keywords: ["test"] }),
    );

    return {
      path: artifactPath,
      relativePath,
      manifest: {
        name,
        version,
        description: "test",
        components: { skills: [], agents: [], commands: [] },
      },
    };
  }

  test("updates grekt.yaml when package.json has a new version", async () => {
    const { syncVersionsToManifest } = await import("./workspace");
    const artifact = setupArtifact("@test/alpha", "1.0.0", "packages/alpha");

    writeFileSync(
      join(artifact.path, "package.json"),
      JSON.stringify({ name: "@test/alpha", version: "1.1.0", private: true }),
    );

    const updated = syncVersionsToManifest([artifact]);

    expect(updated).toBe(1);
    const manifest = readFileSync(join(artifact.path, "grekt.yaml"), "utf-8");
    expect(manifest).toContain("1.1.0");
  });

  test("skips artifact when version is unchanged", async () => {
    const { syncVersionsToManifest } = await import("./workspace");
    const artifact = setupArtifact("@test/alpha", "1.0.0", "packages/alpha");

    writeFileSync(
      join(artifact.path, "package.json"),
      JSON.stringify({ name: "@test/alpha", version: "1.0.0", private: true }),
    );

    const updated = syncVersionsToManifest([artifact]);

    expect(updated).toBe(0);
  });

  test("skips artifact when package.json does not exist", async () => {
    const { syncVersionsToManifest } = await import("./workspace");
    const artifact = setupArtifact("@test/alpha", "1.0.0", "packages/alpha");

    const updated = syncVersionsToManifest([artifact]);

    expect(updated).toBe(0);
  });
});

describe("cleanPackageJsonFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grekt-test-workspace-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("removes package.json from artifact directories", async () => {
    const { cleanPackageJsonFiles } = await import("./workspace");
    const artifactPath = join(tempDir, "packages/alpha");
    mkdirSync(artifactPath, { recursive: true });
    writeFileSync(join(artifactPath, "package.json"), "{}");

    const artifact: WorkspaceArtifact = {
      path: artifactPath,
      relativePath: "packages/alpha",
      manifest: {
        name: "@test/alpha",
        version: "1.0.0",
        description: "test",
        components: { skills: [], agents: [], commands: [] },
      },
    };

    cleanPackageJsonFiles([artifact]);

    expect(existsSync(join(artifactPath, "package.json"))).toBe(false);
  });
});
