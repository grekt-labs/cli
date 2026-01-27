import { describe, test, expect } from "bun:test";
import {
  buildGitHubTarballUrl,
  buildGitLabArchiveUrl,
  getGitHubHeaders,
  getGitLabHeaders,
} from "@grekt-labs/cli-engine";

describe("download", () => {
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

  // Note: downloadAndExtractTarball tests require mocking HTTP client and filesystem
  // These are tested in cli-engine with proper mocks
});
