import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { stringify } from "yaml";

export interface TestProject {
  root: string;
  cleanup: () => void;
}

export interface CreateProjectOptions {
  /** Write grekt.yaml + .grekt/ + .grekt/index (default: false) */
  initialized?: boolean;
  /** Sync targets in grekt.yaml (default: ["claude"]) */
  targets?: string[];
  /** Artifact entries for grekt.yaml: artifactId -> version */
  artifacts?: Record<string, string>;
  /** Raw lockfile content to write as grekt.lock */
  lockfile?: Record<string, unknown>;
  /** Copy a fixture artifact directory into .grekt/artifacts/<name> */
  copyFixture?: string;
}

/**
 * Creates an isolated temp directory for a test project.
 * Automatically cleans up on `cleanup()`.
 */
export function createTestProject(options?: CreateProjectOptions): TestProject {
  const root = mkdtempSync(join(tmpdir(), "grekt-e2e-"));

  if (options?.initialized) {
    const targets = options.targets ?? ["claude"];
    const artifacts: Record<string, string> = options.artifacts ?? {};

    // Create grekt.yaml
    const config = {
      targets,
      autoSync: false,
      artifacts,
      customTargets: {},
    };
    writeFileSync(join(root, "grekt.yaml"), stringify(config));

    // Create .grekt directory structure
    mkdirSync(join(root, ".grekt", "artifacts"), { recursive: true });

    // Create empty index file
    writeFileSync(join(root, ".grekt", "index"), "");
  }

  if (options?.lockfile) {
    writeFileSync(join(root, "grekt.lock"), stringify(options.lockfile));
  }

  if (options?.copyFixture) {
    const fixtureSrc = join(import.meta.dir, "..", "fixtures", "artifacts", options.copyFixture);
    const artifactDest = join(root, ".grekt", "artifacts", "test", "artifact");
    mkdirSync(artifactDest, { recursive: true });
    cpSync(fixtureSrc, artifactDest, { recursive: true });
  }

  return {
    root,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
