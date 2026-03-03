import { describe, test, expect } from "vitest";
import { ensureLongForm } from "./trust";
import type { ArtifactEntry } from "@grekt/engine";
import { generateTrustKey, signTrust, TRUST_SIGNATURE_PREFIX } from "@grekt/engine";

describe("ensureLongForm", () => {
  test("converts string entry to object with version and lazy mode", () => {
    const result = ensureLongForm("1.0.0");
    expect(result.version).toBe("1.0.0");
    expect(result.mode).toBe("lazy");
  });

  test("returns object entry unchanged", () => {
    const entry: ArtifactEntry = { version: "2.0.0", mode: "core" };
    const result = ensureLongForm(entry);
    expect(result.version).toBe("2.0.0");
    expect(result.mode).toBe("core");
  });

  test("preserves existing signature on object entry", () => {
    const key = generateTrustKey();
    const sig = signTrust("@scope/name", key);
    const entry: ArtifactEntry = { version: "1.0.0", mode: "lazy", trusted: sig };
    const result = ensureLongForm(entry);
    expect(result.trusted).toBe(sig);
  });

  test("preserves boolean trusted on object entry (for backwards compat parsing)", () => {
    const entry: ArtifactEntry = { version: "1.0.0", mode: "lazy", trusted: true };
    const result = ensureLongForm(entry);
    expect(result.trusted).toBe(true);
  });
});

describe("trust signing flow", () => {
  const trustKey = generateTrustKey();

  test("setting signature on short form entry produces correct result", () => {
    const entry = ensureLongForm("1.0.0");
    const sig = signTrust("@scope/name", trustKey);
    entry.trusted = sig;

    expect(entry.version).toBe("1.0.0");
    expect(entry.mode).toBe("lazy");
    expect(typeof entry.trusted).toBe("string");
    expect((entry.trusted as string).startsWith(TRUST_SIGNATURE_PREFIX)).toBe(true);
  });

  test("setting signature on long form entry preserves other fields", () => {
    const entry = ensureLongForm({ version: "2.0.0", mode: "core" });
    const sig = signTrust("@scope/name", trustKey);
    entry.trusted = sig;

    expect(entry.version).toBe("2.0.0");
    expect(entry.mode).toBe("core");
    expect(entry.trusted).toBe(sig);
  });

  test("deleting trusted from entry removes the field", () => {
    const sig = signTrust("@scope/name", trustKey);
    const entry: Exclude<ArtifactEntry, string> = { version: "1.0.0", mode: "lazy", trusted: sig };
    delete entry.trusted;

    expect(entry.trusted).toBeUndefined();
    expect(entry.version).toBe("1.0.0");
  });

  test("short form entry has no trusted to delete", () => {
    const entry = "1.0.0";
    expect(typeof entry).toBe("string");
  });
});
