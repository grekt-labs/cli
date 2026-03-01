import { describe, test, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse, stringify } from "yaml";
import { runCli } from "../helpers/cli";
import { createTestProject, type TestProject } from "../helpers/project";
import { generateTrustKey, signTrust, TRUST_SIGNATURE_PREFIX } from "@grekt-labs/cli-engine";

// ──────────────────────────────────────────────────────────────────
// grekt trust --generate-key
// ──────────────────────────────────────────────────────────────────

describe("grekt trust --generate-key", () => {
  test("generates and prints a valid trust key with setup instructions", async () => {
    const result = await runCli(["trust", "--generate-key"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("grk_trust_");
    expect(result.stdout).toContain("GREKT_TRUST_KEY");
    expect(result.stdout).toContain("export");
  });

  test("each invocation produces a different key", async () => {
    const result1 = await runCli(["trust", "--generate-key"]);
    const result2 = await runCli(["trust", "--generate-key"]);

    const extractKey = (stdout: string) => {
      const match = stdout.match(/grk_trust_[0-9a-f]{64}/);
      return match?.[0];
    };

    const key1 = extractKey(result1.stdout);
    const key2 = extractKey(result2.stdout);

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1).not.toBe(key2);
  });
});

// ──────────────────────────────────────────────────────────────────
// grekt trust <artifact> — error cases
// ──────────────────────────────────────────────────────────────────

describe("grekt trust <artifact> — error handling", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("errors without GREKT_TRUST_KEY and shows setup guidance", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });

    const result = await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: "" },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("GREKT_TRUST_KEY");
    expect(result.stdout).toContain("grekt trust --generate-key");
  });

  test("errors with invalid trust key format", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });

    const result = await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: "not-a-valid-key" },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid");
  });

  test("errors when artifact is not in config", async () => {
    project = createTestProject({ initialized: true });
    const key = generateTrustKey();

    const result = await runCli(["trust", "@scope/nonexistent"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: key },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not in config");
  });

  test("errors with no arguments and no --generate-key flag", async () => {
    const result = await runCli(["trust"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Artifact ID is required");
    expect(result.stdout).toContain("grekt trust --generate-key");
  });
});

// ──────────────────────────────────────────────────────────────────
// grekt trust <artifact> — signing
// ──────────────────────────────────────────────────────────────────

describe("grekt trust <artifact> — signing", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("writes HMAC signature to grekt.yaml for short-form entry", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });
    const key = generateTrustKey();

    const result = await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: key },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Signed");

    const config = parse(readFileSync(join(project.root, "grekt.yaml"), "utf-8"));
    const entry = config.artifacts["@scope/tool"];

    expect(typeof entry).toBe("object");
    expect(typeof entry.trusted).toBe("string");
    expect(entry.trusted.startsWith(TRUST_SIGNATURE_PREFIX)).toBe(true);
    // Short form was converted to long form
    expect(entry.version).toBe("1.0.0");
    expect(entry.mode).toBe("lazy");
  });

  test("produced signature matches the expected HMAC for the artifact ID", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });
    const key = generateTrustKey();

    await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: key },
    });

    const config = parse(readFileSync(join(project.root, "grekt.yaml"), "utf-8"));
    const expectedSig = signTrust("@scope/tool", key);

    expect(config.artifacts["@scope/tool"].trusted).toBe(expectedSig);
  });

  test("re-signing an already signed artifact overwrites the old signature", async () => {
    project = createTestProject({ initialized: true });
    const oldKey = generateTrustKey();
    const newKey = generateTrustKey();
    const oldSig = signTrust("@scope/tool", oldKey);
    const configPath = join(project.root, "grekt.yaml");

    writeFileSync(configPath, stringify({
      targets: ["claude"],
      autoSync: false,
      artifacts: { "@scope/tool": { version: "1.0.0", mode: "lazy", trusted: oldSig } },
      customTargets: {},
    }));

    const result = await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: newKey },
    });

    expect(result.exitCode).toBe(0);

    const config = parse(readFileSync(configPath, "utf-8"));
    const newExpected = signTrust("@scope/tool", newKey);
    expect(config.artifacts["@scope/tool"].trusted).toBe(newExpected);
    expect(config.artifacts["@scope/tool"].trusted).not.toBe(oldSig);
  });

  test("signing does not alter other artifact entries", async () => {
    project = createTestProject({ initialized: true });
    const key = generateTrustKey();
    const configPath = join(project.root, "grekt.yaml");

    writeFileSync(configPath, stringify({
      targets: ["claude"],
      autoSync: false,
      artifacts: {
        "@scope/tool": "1.0.0",
        "@other/lib": { version: "2.0.0", mode: "core" },
      },
      customTargets: {},
    }));

    await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: key },
    });

    const config = parse(readFileSync(configPath, "utf-8"));

    // Other entry is untouched
    expect(config.artifacts["@other/lib"].version).toBe("2.0.0");
    expect(config.artifacts["@other/lib"].mode).toBe("core");
    expect(config.artifacts["@other/lib"].trusted).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// grekt untrust <artifact>
// ──────────────────────────────────────────────────────────────────

describe("grekt untrust <artifact>", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("removes HMAC signature from signed artifact", async () => {
    project = createTestProject({ initialized: true });
    const key = generateTrustKey();
    const sig = signTrust("@scope/tool", key);
    const configPath = join(project.root, "grekt.yaml");

    writeFileSync(configPath, stringify({
      targets: ["claude"],
      autoSync: false,
      artifacts: { "@scope/tool": { version: "1.0.0", mode: "lazy", trusted: sig } },
      customTargets: {},
    }));

    const result = await runCli(["untrust", "@scope/tool"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Removed trusted status");

    const config = parse(readFileSync(configPath, "utf-8"));
    expect(config.artifacts["@scope/tool"].trusted).toBeUndefined();
    // Other fields preserved
    expect(config.artifacts["@scope/tool"].version).toBe("1.0.0");
  });

  test("is a no-op on short-form entry (never had trust)", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });

    const result = await runCli(["untrust", "@scope/tool"], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("already not trusted");
  });
});

// ──────────────────────────────────────────────────────────────────
// grekt trust — adversarial E2E scenarios
// ──────────────────────────────────────────────────────────────────

describe("grekt trust — adversarial scenarios", () => {
  let project: TestProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("truncated key is rejected", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });

    const key = generateTrustKey();
    const truncated = key.slice(0, -10);

    const result = await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: truncated },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid");
  });

  test("key with extra characters appended is rejected", async () => {
    project = createTestProject({
      initialized: true,
      artifacts: { "@scope/tool": "1.0.0" },
    });

    const key = generateTrustKey() + "extra";

    const result = await runCli(["trust", "@scope/tool"], {
      cwd: project.root,
      env: { GREKT_TRUST_KEY: key },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid");
  });
});
