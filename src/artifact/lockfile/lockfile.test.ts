import { describe, test } from "bun:test";

describe("lockfile", () => {
  test.todo("getLockfile returns parsed lockfile");
  test.todo("getLockfile returns empty lockfile when missing");
  test.todo("saveLockfile writes valid YAML");
  test.todo("createEmptyLockfile returns version 1 lockfile");
  test.todo("lockfile preserves resolved URLs immutably");
});
