import { describe, test } from "bun:test";

describe("formatters", () => {
  test.todo("formatBytes returns B for bytes < 1024");
  test.todo("formatBytes returns KB for bytes < 1MB");
  test.todo("formatBytes returns MB for bytes >= 1MB");
  test.todo("estimateTokens divides bytes by 4");
  test.todo("formatNumber adds thousand separators");
  test.todo("formatTokenEstimate combines estimation and formatting");
});
