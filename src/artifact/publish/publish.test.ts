import { describe, test, expect, mock } from "bun:test";
import {
  isApproachingSizeLimit,
  checkVersionExists,
  publishArtifact,
} from "./publish";

describe("publish", () => {
  describe("isApproachingSizeLimit", () => {
    test("returns false when under warning threshold", () => {
      expect(isApproachingSizeLimit(1024)).toBe(false);
    });

    test("returns false at exactly warning threshold", () => {
      expect(isApproachingSizeLimit(8 * 1024 * 1024)).toBe(false);
    });

    test("returns true when above warning threshold", () => {
      expect(isApproachingSizeLimit(8 * 1024 * 1024 + 1)).toBe(true);
    });
  });

  describe("checkVersionExists", () => {
    test("returns exists true when version found", async () => {
      const publisher = {
        versionExists: mock().mockResolvedValue(true),
      } as unknown as Parameters<typeof checkVersionExists>[0];

      const result = await checkVersionExists(publisher, {} as Parameters<typeof checkVersionExists>[1]);

      expect(result).toEqual({ exists: true });
    });

    test("returns exists false when version not found", async () => {
      const publisher = {
        versionExists: mock().mockResolvedValue(false),
      } as unknown as Parameters<typeof checkVersionExists>[0];

      const result = await checkVersionExists(publisher, {} as Parameters<typeof checkVersionExists>[1]);

      expect(result).toEqual({ exists: false });
    });

    test("returns checkFailed on error", async () => {
      const publisher = {
        versionExists: mock().mockRejectedValue(new Error("network error")),
      } as unknown as Parameters<typeof checkVersionExists>[0];

      const result = await checkVersionExists(publisher, {} as Parameters<typeof checkVersionExists>[1]);

      expect(result.exists).toBe(false);
      expect(result.checkFailed).toBe(true);
      expect(result.error).toBe("network error");
    });
  });

  describe("publishArtifact", () => {
    test("delegates to publisher.publish", async () => {
      const expected = { success: true, url: "https://example.com" };
      const publisher = {
        publish: mock().mockResolvedValue(expected),
      } as unknown as Parameters<typeof publishArtifact>[0];

      const result = await publishArtifact(publisher, {} as Parameters<typeof publishArtifact>[1]);

      expect(result).toEqual(expected);
    });
  });
});
