import { describe, test, expect } from "bun:test";
import { createPublisher, getPublisherTypeName } from "./factory";
import type { Publisher } from "./publisher.types";

describe("publishers", () => {
  describe("getPublisherTypeName", () => {
    test("returns 'grekt registry' for api type", () => {
      const publisher = { type: "api" } as Publisher;
      expect(getPublisherTypeName(publisher)).toBe("grekt registry");
    });

    test("returns 'S3 storage' for s3 type", () => {
      const publisher = { type: "s3" } as Publisher;
      expect(getPublisherTypeName(publisher)).toBe("S3 storage");
    });

    test("returns 'GitLab registry' for gitlab type", () => {
      const publisher = { type: "gitlab" } as Publisher;
      expect(getPublisherTypeName(publisher)).toBe("GitLab registry");
    });

    test("returns 'GitHub registry' for github type", () => {
      const publisher = { type: "github" } as Publisher;
      expect(getPublisherTypeName(publisher)).toBe("GitHub registry");
    });

    test("returns formatted name for unknown types", () => {
      const publisher = { type: "custom" } as Publisher;
      expect(getPublisherTypeName(publisher)).toBe("custom registry");
    });
  });

  describe("createPublisher", () => {
    test("returns publisher with type and methods", () => {
      const publisher = createPublisher({
        scope: "@test",
        projectRoot: "/nonexistent",
      });

      expect(publisher).toBeDefined();
      expect(typeof publisher.type).toBe("string");
      expect(typeof publisher.publish).toBe("function");
      expect(typeof publisher.versionExists).toBe("function");
    });

    test("returns S3Publisher when s3 option is true", () => {
      const publisher = createPublisher({
        s3: true,
        scope: "@test",
        projectRoot: "/nonexistent",
      });

      expect(publisher.type).toBe("s3");
    });

    test("returns ApiPublisher by default", () => {
      const publisher = createPublisher({
        scope: "@test",
        projectRoot: "/nonexistent",
      });

      expect(publisher.type).toBe("api");
    });
  });

  // Note: Full publisher tests (ApiPublisher, CustomPublisher, S3Publisher)
  // require mocking external services (Supabase, GitLab API, S3).
  // These are integration tests best run in CI with test credentials.
});
