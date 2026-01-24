import { describe, test } from "bun:test";

describe("download", () => {
  test.todo("downloadAndExtractTarball downloads and extracts tarball");
  test.todo("downloadAndExtractTarball handles HTTP errors");
  test.todo("downloadAndExtractTarball cleans up temp files on failure");
  test.todo("downloadAndExtractTarball respects stripComponents option");
  test.todo("buildGitHubTarballUrl builds correct URL");
  test.todo("buildGitHubTarballUrl handles ref parameter");
  test.todo("buildGitLabArchiveUrl builds correct URL");
  test.todo("buildGitLabArchiveUrl encodes project path");
  test.todo("getGitHubHeaders includes auth when token provided");
  test.todo("getGitLabHeaders uses PRIVATE-TOKEN header");
});
