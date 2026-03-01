import { describe, test, expect, vi, afterEach } from "vitest";
import {
  buildGitHubTarballUrl,
  buildGitLabArchiveUrl,
  getGitHubHeaders,
  getGitLabHeaders,
} from "@grekt-labs/cli-engine";
import { downloadAndExtractTarball } from "./download";
import { createFetchLikeResponse } from "#/test-utils";

describe("download", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("buildGitHubTarballUrl", () => {
    test("builds correct URL", () => {
      const url = buildGitHubTarballUrl("owner", "repo");

      expect(url).toBe("https://api.github.com/repos/owner/repo/tarball/HEAD");
    });

    test("handles ref parameter", () => {
      const url = buildGitHubTarballUrl("owner", "repo", "v1.0.0");

      expect(url).toBe("https://api.github.com/repos/owner/repo/tarball/v1.0.0");
    });

    test("handles branch ref", () => {
      const url = buildGitHubTarballUrl("owner", "repo", "main");

      expect(url).toBe("https://api.github.com/repos/owner/repo/tarball/main");
    });
  });

  describe("buildGitLabArchiveUrl", () => {
    test("builds correct URL", () => {
      const url = buildGitLabArchiveUrl("gitlab.com", "owner/repo");

      expect(url).toContain("gitlab.com");
      expect(url).toContain("archive.tar.gz");
    });

    test("encodes project path", () => {
      const url = buildGitLabArchiveUrl("gitlab.com", "group/subgroup/project");

      expect(url).toContain("group%2Fsubgroup%2Fproject");
    });

    test("handles custom host", () => {
      const url = buildGitLabArchiveUrl("gitlab.mycompany.com", "team/project");

      expect(url).toContain("gitlab.mycompany.com");
    });

    test("includes ref parameter", () => {
      const url = buildGitLabArchiveUrl("gitlab.com", "owner/repo", "v2.0.0");

      expect(url).toContain("sha=v2.0.0");
    });
  });

  describe("getGitHubHeaders", () => {
    test("returns base headers without token", () => {
      const headers = getGitHubHeaders();

      expect(headers["User-Agent"]).toBe("grekt-cli");
      expect(headers.Accept).toBe("application/vnd.github+json");
      expect(headers.Authorization).toBeUndefined();
    });

    test("includes auth when token provided", () => {
      const headers = getGitHubHeaders("my-token");

      expect(headers.Authorization).toBe("Bearer my-token");
    });
  });

  describe("getGitLabHeaders", () => {
    test("returns base headers without token", () => {
      const headers = getGitLabHeaders();

      expect(headers["User-Agent"]).toBe("grekt-cli");
      expect(headers["PRIVATE-TOKEN"]).toBeUndefined();
    });

    test("uses PRIVATE-TOKEN header", () => {
      const headers = getGitLabHeaders("my-gitlab-token");

      expect(headers["PRIVATE-TOKEN"]).toBe("my-gitlab-token");
    });
  });

  describe("downloadAndExtractTarball", () => {
    test("returns error when HTTP response is not ok", async () => {
      globalThis.fetch = vi.fn(async () =>
        createFetchLikeResponse({ ok: false, status: 404, statusText: "Not Found" })
      ) as unknown as typeof fetch;

      const result = await downloadAndExtractTarball("https://example.com/tar.gz", "/tmp/grekt-test");

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 404");
    });

    test("sets User-Agent header", async () => {
      globalThis.fetch = vi.fn(async () =>
        createFetchLikeResponse({ ok: false, status: 500, statusText: "Server Error" })
      ) as unknown as typeof fetch;

      await downloadAndExtractTarball("https://example.com/tar.gz", "/tmp/grekt-test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example.com/tar.gz",
        expect.objectContaining({
          headers: expect.objectContaining({ "User-Agent": "grekt-cli" }),
        })
      );
    });
  });
});
