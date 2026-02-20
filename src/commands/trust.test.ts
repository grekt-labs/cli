import { describe, test, expect } from "bun:test";
import { ensureLongForm } from "./trust";
import type { ArtifactEntry } from "@grekt-labs/cli-engine";

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

  test("preserves existing fields on object entry", () => {
    const entry: ArtifactEntry = { version: "1.0.0", mode: "lazy", trusted: true };
    const result = ensureLongForm(entry);
    expect(result.trusted).toBe(true);
  });
});

describe("trust logic", () => {
  test("setting trusted on short form entry produces correct result", () => {
    const entry = ensureLongForm("1.0.0");
    entry.trusted = true;

    expect(entry.version).toBe("1.0.0");
    expect(entry.mode).toBe("lazy");
    expect(entry.trusted).toBe(true);
  });

  test("setting trusted on long form entry preserves other fields", () => {
    const entry = ensureLongForm({ version: "2.0.0", mode: "core" });
    entry.trusted = true;

    expect(entry.version).toBe("2.0.0");
    expect(entry.mode).toBe("core");
    expect(entry.trusted).toBe(true);
  });

  test("deleting trusted from entry removes the field", () => {
    const entry: Exclude<ArtifactEntry, string> = { version: "1.0.0", mode: "lazy", trusted: true };
    delete entry.trusted;

    expect(entry.trusted).toBeUndefined();
    expect(entry.version).toBe("1.0.0");
  });

  test("short form entry has no trusted to delete", () => {
    const entry = "1.0.0";
    // Short form is a string, typeof check prevents mutation
    expect(typeof entry).toBe("string");
  });
});
