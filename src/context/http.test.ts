import { describe, test, expect, vi, afterEach } from "vitest";
import { createHttpClient } from "./http";
import { createMockFetch } from "#/test-utils";

describe("createHttpClient", () => {
  let restoreFetch: (() => void) | undefined;

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = undefined;
  });

  test("applies default timeout signal when caller provides none", async () => {
    let capturedSignal: AbortSignal | null | undefined = null;

    restoreFetch = createMockFetch(async (_url, init) => {
      capturedSignal = init?.signal;
      return new Response("ok");
    });

    const client = createHttpClient();
    await client.fetch("https://example.com");

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal!.aborted).toBe(false);
  });

  test("uses caller signal when provided", async () => {
    const callerController = new AbortController();
    let capturedSignal: AbortSignal | null | undefined = null;

    restoreFetch = createMockFetch(async (_url, init) => {
      capturedSignal = init?.signal;
      return new Response("ok");
    });

    const client = createHttpClient();
    await client.fetch("https://example.com", { signal: callerController.signal });

    expect(capturedSignal).toBe(callerController.signal);
  });

  test("passes url and options through to fetch", async () => {
    let capturedUrl: string | URL | Request = "";
    let capturedInit: RequestInit | undefined;

    restoreFetch = createMockFetch(async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response("ok");
    });

    const client = createHttpClient();
    await client.fetch("https://example.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    expect(capturedUrl).toBe("https://example.com/api");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(capturedInit?.body).toBe(JSON.stringify({ test: true }));
  });
});
