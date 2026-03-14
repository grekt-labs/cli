import { describe, test, expect } from "vitest";
import {
  generateTrustKey,
  signTrust,
  verifyTrustSignature,
} from "@grekt/engine";
import { isArtifactTrusted } from "#/artifact/mode/mode";
import { ensureLongForm } from "#/commands/trust";
import { evaluateFailOn } from "#/commands/scan";
import type { ProjectConfig, SecurityReport, TrustBadge } from "@grekt/engine";

const baseConfig: ProjectConfig = {
  targets: [],
  artifacts: {},
  customTargets: {},
};

function makeReport(badge: TrustBadge, score = 80): SecurityReport {
  return {
    score,
    badge,
    findings: [],
    categoryScores: {},
    scannedAt: new Date().toISOString(),
    filesScanned: 1,
  };
}

function buildConfig(artifacts: ProjectConfig["artifacts"]): ProjectConfig {
  return { ...baseConfig, artifacts };
}

// ──────────────────────────────────────────────────────────────────
// Workflow 1: Lead onboards HMAC trust for their team
// ──────────────────────────────────────────────────────────────────

describe("Lead onboards HMAC trust for the first time", () => {
  test("generates a key, signs a risky artifact, and it passes scan --fail-on", () => {
    // Step 1: Lead runs `grekt trust --init` and gets a key
    const trustKey = generateTrustKey();

    // Step 2: Lead reviews @vendor/sketchy and decides to trust it
    const artifactId = "@vendor/sketchy";
    const entry = ensureLongForm("2.1.0");
    entry.trusted = signTrust(artifactId, trustKey);

    // Step 3: Lead commits the updated grekt.yaml
    const config = buildConfig({ [artifactId]: entry });

    // Step 4: CI runs `grekt scan --fail-on suspicious` with the same key
    const trusted = isArtifactTrusted(artifactId, config, trustKey);
    const results = [{ artifactId, summary: makeReport("suspicious"), trusted }];
    const failOn = evaluateFailOn(results, "suspicious");

    // Result: signed artifact passes, CI is green
    expect(trusted).toBe(true);
    expect(failOn.failed).toBe(false);
  });

  test("unsigned artifacts in the same project still block CI", () => {
    const trustKey = generateTrustKey();
    const signedSig = signTrust("@vendor/reviewed", trustKey);

    const config = buildConfig({
      "@vendor/reviewed": { version: "1.0.0", mode: "lazy", trusted: signedSig },
      "@vendor/new-and-unreviewed": { version: "1.0.0", mode: "lazy" },
    });

    const results = [
      {
        artifactId: "@vendor/reviewed",
        summary: makeReport("suspicious"),
        trusted: isArtifactTrusted("@vendor/reviewed", config, trustKey),
      },
      {
        artifactId: "@vendor/new-and-unreviewed",
        summary: makeReport("suspicious"),
        trusted: isArtifactTrusted("@vendor/new-and-unreviewed", config, trustKey),
      },
    ];

    const failOn = evaluateFailOn(results, "suspicious");

    expect(failOn.failed).toBe(true);
    expect(failOn.failedArtifacts).toHaveLength(1);
    expect(failOn.failedArtifacts[0].artifactId).toBe("@vendor/new-and-unreviewed");
  });
});

// ──────────────────────────────────────────────────────────────────
// Workflow 2: CI runs scan without a trust key (new team, no setup)
// ──────────────────────────────────────────────────────────────────

describe("CI runs scan without GREKT_TRUST_KEY configured", () => {
  test("all artifacts are evaluated against threshold, even if yaml has signatures", () => {
    const someKey = generateTrustKey();
    const sig = signTrust("@vendor/tool", someKey);

    const config = buildConfig({
      "@vendor/tool": { version: "1.0.0", mode: "lazy", trusted: sig },
    });

    // CI does NOT have GREKT_TRUST_KEY set
    const trusted = isArtifactTrusted("@vendor/tool", config, undefined);
    const results = [{ artifactId: "@vendor/tool", summary: makeReport("suspicious"), trusted }];
    const failOn = evaluateFailOn(results, "suspicious");

    expect(trusted).toBe(false);
    expect(failOn.failed).toBe(true);
  });

  test("legacy trusted: true in yaml is also rejected without key", () => {
    const config = buildConfig({
      "@legacy/tool": { version: "1.0.0", mode: "lazy", trusted: true },
    });

    const trusted = isArtifactTrusted("@legacy/tool", config, undefined);
    expect(trusted).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Workflow 3: Attacker tries to bypass scan in a PR
// ──────────────────────────────────────────────────────────────────

describe("Attacker submits a PR with forged trust", () => {
  const ciKey = generateTrustKey();

  test("manually writing trusted: true in grekt.yaml does not bypass scan", () => {
    const config = buildConfig({
      "@attacker/payload": { version: "1.0.0", mode: "lazy", trusted: true },
    });

    const trusted = isArtifactTrusted("@attacker/payload", config, ciKey);
    const results = [{ artifactId: "@attacker/payload", summary: makeReport("rejected"), trusted }];
    const failOn = evaluateFailOn(results, "suspicious");

    expect(trusted).toBe(false);
    expect(failOn.failed).toBe(true);
  });

  test("fabricating a grk_sig_ string without the key does not bypass scan", () => {
    const forgedSig = "grk_sig_" + "deadbeef".repeat(8);

    const config = buildConfig({
      "@attacker/payload": { version: "1.0.0", mode: "lazy", trusted: forgedSig },
    });

    const trusted = isArtifactTrusted("@attacker/payload", config, ciKey);
    expect(trusted).toBe(false);
  });

  test("signing with a different key does not pass CI verification", () => {
    const attackerKey = generateTrustKey();
    const attackerSig = signTrust("@attacker/payload", attackerKey);

    const config = buildConfig({
      "@attacker/payload": { version: "1.0.0", mode: "lazy", trusted: attackerSig },
    });

    // CI uses the real team key, not the attacker's
    const trusted = isArtifactTrusted("@attacker/payload", config, ciKey);
    expect(trusted).toBe(false);
  });

  test("copying a valid signature from artifact A onto artifact B does not work", () => {
    const legitimateSig = signTrust("@legit/safe-tool", ciKey);

    const config = buildConfig({
      "@attacker/payload": { version: "1.0.0", mode: "lazy", trusted: legitimateSig },
    });

    const trusted = isArtifactTrusted("@attacker/payload", config, ciKey);
    expect(trusted).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Workflow 4: Team migrates from legacy trusted: true to HMAC
// ──────────────────────────────────────────────────────────────────

describe("Team migrates from legacy boolean trust to HMAC", () => {
  const trustKey = generateTrustKey();

  test("old trusted: true entries are treated as untrusted after migration", () => {
    const config = buildConfig({
      "@old/tool": { version: "1.0.0", mode: "lazy", trusted: true },
    });

    const trusted = isArtifactTrusted("@old/tool", config, trustKey);
    expect(trusted).toBe(false);
  });

  test("re-signing old artifacts with HMAC makes them trusted again", () => {
    // Lead re-signs the old artifact
    const sig = signTrust("@old/tool", trustKey);
    const config = buildConfig({
      "@old/tool": { version: "1.0.0", mode: "lazy", trusted: sig },
    });

    const trusted = isArtifactTrusted("@old/tool", config, trustKey);
    expect(trusted).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// Workflow 5: Lead revokes trust and re-signs after re-audit
// ──────────────────────────────────────────────────────────────────

describe("Lead revokes and re-signs trust after artifact update", () => {
  const trustKey = generateTrustKey();
  const artifactId = "@vendor/tool";

  test("untrust removes signature, scan catches it, re-trust restores it", () => {
    // Artifact was signed
    const originalSig = signTrust(artifactId, trustKey);
    let entry: Exclude<ReturnType<typeof ensureLongForm>, string> = {
      version: "3.0.0",
      mode: "lazy",
      trusted: originalSig,
    };
    let config = buildConfig({ [artifactId]: entry });

    expect(isArtifactTrusted(artifactId, config, trustKey)).toBe(true);

    // Lead runs `grekt untrust @vendor/tool`
    delete entry.trusted;
    config = buildConfig({ [artifactId]: { ...entry } });

    expect(isArtifactTrusted(artifactId, config, trustKey)).toBe(false);

    // CI now blocks it
    const results = [
      { artifactId, summary: makeReport("suspicious"), trusted: false },
    ];
    expect(evaluateFailOn(results, "suspicious").failed).toBe(true);

    // Lead re-audits and re-signs
    const newSig = signTrust(artifactId, trustKey);
    entry = { version: "3.0.0", mode: "lazy", trusted: newSig };
    config = buildConfig({ [artifactId]: entry });

    expect(isArtifactTrusted(artifactId, config, trustKey)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// Workflow 6: Realistic CI pipeline with mixed artifact states
// ──────────────────────────────────────────────────────────────────

describe("CI pipeline scans project with mixed artifact states", () => {
  const trustKey = generateTrustKey();

  test("only properly signed artifacts pass, everything else blocks", () => {
    const signedSig = signTrust("@vendor/audited", trustKey);
    const attackerSig = signTrust("@attacker/payload", generateTrustKey());

    const config = buildConfig({
      "@vendor/audited":    { version: "1.0.0", mode: "lazy", trusted: signedSig },
      "@vendor/new":        { version: "1.0.0", mode: "lazy" },
      "@legacy/old":        { version: "1.0.0", mode: "lazy", trusted: true },
      "@attacker/payload":  { version: "1.0.0", mode: "lazy", trusted: attackerSig },
      "@vendor/clean":      { version: "1.0.0", mode: "lazy" },
    });

    const artifacts = [
      { id: "@vendor/audited",   badge: "suspicious" as TrustBadge },
      { id: "@vendor/new",       badge: "suspicious" as TrustBadge },
      { id: "@legacy/old",       badge: "suspicious" as TrustBadge },
      { id: "@attacker/payload", badge: "rejected" as TrustBadge },
      { id: "@vendor/clean",     badge: "certified" as TrustBadge },
    ];

    const results = artifacts.map(({ id, badge }) => ({
      artifactId: id,
      summary: makeReport(badge),
      trusted: isArtifactTrusted(id, config, trustKey),
    }));

    const failOn = evaluateFailOn(results, "suspicious");

    // Only @vendor/audited is truly trusted
    expect(results.find(r => r.artifactId === "@vendor/audited")!.trusted).toBe(true);
    expect(results.find(r => r.artifactId === "@vendor/new")!.trusted).toBe(false);
    expect(results.find(r => r.artifactId === "@legacy/old")!.trusted).toBe(false);
    expect(results.find(r => r.artifactId === "@attacker/payload")!.trusted).toBe(false);
    expect(results.find(r => r.artifactId === "@vendor/clean")!.trusted).toBe(false);

    // CI fails: @vendor/new, @legacy/old, @attacker/payload are at or above threshold
    // @vendor/clean is certified (below threshold), @vendor/audited is trusted (skipped)
    expect(failOn.failed).toBe(true);
    expect(failOn.failedArtifacts).toHaveLength(3);

    const failedIds = failOn.failedArtifacts.map(f => f.artifactId).sort();
    expect(failedIds).toEqual([
      "@attacker/payload",
      "@legacy/old",
      "@vendor/new",
    ]);
  });
});
