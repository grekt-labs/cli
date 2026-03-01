import { describe, test, expect, vi, beforeEach } from "vitest";
import { createValidatedArtifact, createTarballResult } from "#/test-utils";

const { mockValidateArtifact, mockCreateTarball, mockRemoveTarball } = vi.hoisted(() => ({
  mockValidateArtifact: vi.fn(),
  mockCreateTarball: vi.fn(),
  mockRemoveTarball: vi.fn(),
}));

vi.mock("#/artifact/validation/validation", () => ({
  validateArtifact: mockValidateArtifact,
}));

vi.mock("#/artifact/tarball/tarball", () => ({
  createTarball: mockCreateTarball,
  removeTarball: mockRemoveTarball,
}));

import { prepareArtifact } from "./publish";
import type { ValidationError } from "./publish";

const VALID_ARTIFACT = createValidatedArtifact();
const VALID_TARBALL = createTarballResult();

describe("prepareArtifact", () => {
  beforeEach(() => {
    mockValidateArtifact.mockClear();
    mockCreateTarball.mockClear();
    mockRemoveTarball.mockClear();
  });

  test("throws with validationError when validation fails", () => {
    mockValidateArtifact.mockReturnValue({
      success: false,
      error: { message: "Missing frontmatter", type: "frontmatter", details: ["grk-name required"] },
    });

    try {
      prepareArtifact("/path", "/root");
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const error = err as Error & { validationError: ValidationError };
      expect(error.message).toBe("Missing frontmatter");
      expect(error.validationError.type).toBe("frontmatter");
      expect(error.validationError.details).toEqual(["grk-name required"]);
    }
  });

  test("throws with no-scope type when artifact has no scope", () => {
    mockValidateArtifact.mockReturnValue({
      success: true,
      artifact: { ...VALID_ARTIFACT, scope: null, artifactId: "no-scope" },
    });

    try {
      prepareArtifact("/path", "/root");
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const error = err as Error & { validationError: ValidationError };
      expect(error.message).toContain("scope");
      expect(error.validationError.type).toBe("no-scope");
    }
  });

  test("throws when tarball creation fails", () => {
    mockValidateArtifact.mockReturnValue({ success: true, artifact: VALID_ARTIFACT });
    mockCreateTarball.mockReturnValue({ success: false, error: "disk full" });

    expect(() => prepareArtifact("/path", "/root")).toThrow("Failed to create tarball: disk full");
  });

  test("removes tarball and throws size-limit error when too large", () => {
    mockValidateArtifact.mockReturnValue({ success: true, artifact: VALID_ARTIFACT });
    mockCreateTarball.mockReturnValue({
      ...VALID_TARBALL,
      sizeBytes: 11 * 1024 * 1024,
    });

    try {
      prepareArtifact("/path", "/root");
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const error = err as Error & { validationError: ValidationError };
      expect(error.validationError.type).toBe("size-limit");
      expect(mockRemoveTarball).toHaveBeenCalledWith(VALID_TARBALL.path);
    }
  });

  test("returns artifact info and tarball details on success", () => {
    mockValidateArtifact.mockReturnValue({ success: true, artifact: VALID_ARTIFACT });
    mockCreateTarball.mockReturnValue(VALID_TARBALL);

    const result = prepareArtifact("/path/to/artifact", "/root");

    expect(result.artifact.artifactId).toBe("@scope/test");
    expect(result.artifact.scope).toBe("scope");
    expect(result.artifact.manifest.version).toBe("1.0.0");
    expect(result.artifact.componentCount).toBe(3);
    expect(result.tarballPath).toBe(VALID_TARBALL.path);
    expect(result.tarballFilename).toBe(VALID_TARBALL.filename);
    expect(result.tarballSize).toBe(5000);
  });

  test("passes keyword requirements to validateArtifact", () => {
    mockValidateArtifact.mockReturnValue({ success: true, artifact: VALID_ARTIFACT });
    mockCreateTarball.mockReturnValue(VALID_TARBALL);

    prepareArtifact("/my/artifact", "/my/root");

    expect(mockValidateArtifact).toHaveBeenCalledWith("/my/artifact", "/my/root", {
      requireKeywords: { min: 3, max: 5 },
    });
  });

  test("passes artifact path and components to createTarball", () => {
    mockValidateArtifact.mockReturnValue({ success: true, artifact: VALID_ARTIFACT });
    mockCreateTarball.mockReturnValue(VALID_TARBALL);

    prepareArtifact("/path", "/root");

    const tarballCall = mockCreateTarball.mock.calls[0][0];
    expect(tarballCall.artifactPath).toBe(VALID_ARTIFACT.fullPath);
    expect(tarballCall.artifactId).toBe("@scope/test");
    expect(tarballCall.projectRoot).toBe("/root");
  });
});
