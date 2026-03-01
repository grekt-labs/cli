import { describe, test, expect } from "vitest";
import { compareVersions } from "./update-check";

describe("compareVersions", () => {
  test("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  test("returns positive when a has a newer major", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  test("returns negative when a has an older major", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  test("returns positive when a has a newer minor", () => {
    expect(compareVersions("1.3.0", "1.2.9")).toBeGreaterThan(0);
  });

  test("returns negative when a has an older minor", () => {
    expect(compareVersions("1.2.0", "1.3.0")).toBeLessThan(0);
  });

  test("returns positive when a has a newer patch", () => {
    expect(compareVersions("1.2.4", "1.2.3")).toBeGreaterThan(0);
  });

  test("returns negative when a has an older patch", () => {
    expect(compareVersions("1.2.2", "1.2.3")).toBeLessThan(0);
  });

  test("treats missing segments as 0", () => {
    expect(compareVersions("2.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("1", "1.0.0")).toBe(0);
  });

  test("returns 0 for identical single-segment versions", () => {
    expect(compareVersions("5", "5")).toBe(0);
  });
});

// Integration scenarios (cache read/write, fetch, exit handler) are
// environment-dependent and should be tested manually or in e2e suites.
// See the verification steps in the feature plan for guidance.
