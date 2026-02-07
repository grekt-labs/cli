import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";

describe("logger", () => {
  let originalLogLevel: string | undefined;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    originalLogLevel = process.env.GREKT_LOG_LEVEL;
    stderrSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalLogLevel === undefined) {
      delete process.env.GREKT_LOG_LEVEL;
    } else {
      process.env.GREKT_LOG_LEVEL = originalLogLevel;
    }
    stderrSpy.mockRestore();
  });

  function freshLogger() {
    // Re-import to pick up env changes (logger reads env at call time)
    delete require.cache[require.resolve("./logger")];
    return require("./logger").logger;
  }

  describe("debug level", () => {
    test("logs debug messages when level is debug", () => {
      process.env.GREKT_LOG_LEVEL = "debug";
      const logger = freshLogger();

      logger.debug("test message");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain("[debug]");
      expect(stderrSpy.mock.calls[0][0]).toContain("test message");
    });

    test("logs verbose messages when level is debug", () => {
      process.env.GREKT_LOG_LEVEL = "debug";
      const logger = freshLogger();

      logger.verbose("verbose msg");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain("[verbose]");
    });
  });

  describe("verbose level", () => {
    test("does not log debug messages when level is verbose", () => {
      process.env.GREKT_LOG_LEVEL = "verbose";
      const logger = freshLogger();

      logger.debug("should not appear");

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test("logs verbose messages when level is verbose", () => {
      process.env.GREKT_LOG_LEVEL = "verbose";
      const logger = freshLogger();

      logger.verbose("should appear");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain("should appear");
    });
  });

  describe("info level (default)", () => {
    test("does not log debug messages at default level", () => {
      delete process.env.GREKT_LOG_LEVEL;
      const logger = freshLogger();

      logger.debug("nope");

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test("does not log verbose messages at default level", () => {
      delete process.env.GREKT_LOG_LEVEL;
      const logger = freshLogger();

      logger.verbose("nope");

      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe("invalid level", () => {
    test("falls back to info for unknown level", () => {
      process.env.GREKT_LOG_LEVEL = "banana";
      const logger = freshLogger();

      logger.debug("nope");
      logger.verbose("nope");

      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe("formatting", () => {
    test("formats Error objects by message", () => {
      process.env.GREKT_LOG_LEVEL = "debug";
      const logger = freshLogger();

      logger.debug("failed:", new Error("connection refused"));

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain("connection refused");
    });

    test("formats objects as JSON", () => {
      process.env.GREKT_LOG_LEVEL = "debug";
      const logger = freshLogger();

      logger.debug("data:", { key: "value" });

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain('{"key":"value"}');
    });

    test("joins multiple args with spaces", () => {
      process.env.GREKT_LOG_LEVEL = "debug";
      const logger = freshLogger();

      logger.debug("a", "b", "c");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy.mock.calls[0][0]).toContain("a b c");
    });

    test("includes timestamp in output", () => {
      process.env.GREKT_LOG_LEVEL = "debug";
      const logger = freshLogger();

      logger.debug("test");

      // Timestamp format: HH:MM:SS.mmm
      expect(stderrSpy.mock.calls[0][0]).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
    });
  });
});
