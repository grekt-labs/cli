import { describe, test, expect } from "bun:test";
import {
  GREKT_YAML,
  LOCKFILE,
  GREKT_DIR,
  ARTIFACTS_DIR,
  DEFAULT_REGISTRY,
} from "./paths";
import { LOCKFILE as LOCKFILE_FROM_CONSTANTS } from "#/constants";

describe("paths", () => {
  test("GREKT_YAML is grekt.yaml", () => {
    expect(GREKT_YAML).toBe("grekt.yaml");
  });

  test("LOCKFILE is grekt.lock", () => {
    expect(LOCKFILE).toBe("grekt.lock");
  });

  test("GREKT_DIR is .grekt", () => {
    expect(GREKT_DIR).toBe(".grekt");
  });

  test("ARTIFACTS_DIR is .grekt/artifacts", () => {
    expect(ARTIFACTS_DIR).toBe(".grekt/artifacts");
  });

  test("DEFAULT_REGISTRY is https://registry.grekt.com", () => {
    expect(DEFAULT_REGISTRY).toBe("https://registry.grekt.com");
  });

  test("LOCKFILE re-exported from constants matches", () => {
    expect(LOCKFILE).toBe(LOCKFILE_FROM_CONSTANTS);
  });
});
