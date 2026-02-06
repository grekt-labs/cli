import { describe, test, expect } from "bun:test";
import { formatBytes } from "./format";

describe("formatBytes", () => {
  test("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  test("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10.0 KB");
    expect(formatBytes(1048575)).toBe("1024.0 KB");
  });

  test("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1572864)).toBe("1.50 MB");
    expect(formatBytes(10485760)).toBe("10.00 MB");
    expect(formatBytes(8388608)).toBe("8.00 MB");
  });

  test("handles edge cases", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1024 * 1024 * 100)).toBe("100.00 MB");
  });
});
