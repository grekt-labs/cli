import { describe, test } from "bun:test";

describe("integrity", () => {
  test.todo("hashFile returns sha256 hash");
  test.todo("hashFile returns consistent hash for same content");
  test.todo("hashDirectory hashes all files");
  test.todo("calculateIntegrity returns file hashes map");
  test.todo("verifyIntegrity detects missing files");
  test.todo("verifyIntegrity detects modified files");
  test.todo("verifyIntegrity passes for matching files");
});
