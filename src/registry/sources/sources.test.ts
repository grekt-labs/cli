import { describe, test } from "bun:test";

describe("sources", () => {
  test.todo("parseSource detects registry format");
  test.todo("parseSource detects github: format");
  test.todo("parseSource detects gitlab: format");
  test.todo("parseSource extracts version from @version");
  test.todo("parseSource extracts ref from #ref");
  test.todo("downloadFromSource downloads from registry");
  test.todo("downloadFromSource downloads from github");
  test.todo("downloadFromSource downloads from gitlab");
});
