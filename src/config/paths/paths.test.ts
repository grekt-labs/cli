import { describe, test, expect } from "bun:test";
import {
  GREKT_YAML,
  LOCKFILE,
  GREKT_DIR,
  ARTIFACTS_DIR,
} from "./paths";
import { LOCKFILE as LOCKFILE_FROM_CONSTANTS } from "#/constants";

describe("paths", () => {
  test("ARTIFACTS_DIR is nested under GREKT_DIR", () => {
    expect(ARTIFACTS_DIR.startsWith(GREKT_DIR)).toBe(true);
  });

  test("LOCKFILE re-exported from constants matches paths module", () => {
    expect(LOCKFILE).toBe(LOCKFILE_FROM_CONSTANTS);
  });

  test("config file uses yaml extension", () => {
    expect(GREKT_YAML).toEndWith(".yaml");
  });

  test("lockfile uses lock extension", () => {
    expect(LOCKFILE).toEndWith(".lock");
  });
});
