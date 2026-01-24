import { describe, test } from "bun:test";

describe("publishers", () => {
  describe("factory", () => {
    test.todo("createPublisher returns S3Publisher when s3 option is true");
    test.todo("createPublisher returns CustomPublisher for custom registry");
    test.todo("createPublisher returns ApiPublisher for default registry");
    test.todo("getPublisherTypeName returns correct names");
  });

  describe("ApiPublisher", () => {
    test.todo("versionExists returns false when not authenticated");
    test.todo("publish returns error when not authenticated");
    test.todo("publish uploads to signed URL");
  });

  describe("CustomPublisher", () => {
    test.todo("uses registry client for version check");
    test.todo("publish delegates to registry client");
  });

  describe("S3Publisher", () => {
    test.todo("hasCredentials returns false without credentials");
    test.todo("getCredentials checks env vars first");
    test.todo("publish uploads to S3 bucket");
    test.todo("publish updates metadata after upload");
  });
});
