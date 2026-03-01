import { describe, test, expect, vi } from "vitest";
import { createHttpClient } from "./http";

const originalFetch = globalThis.fetch;

describe("createHttpClient", () => {
  test("applies default timeout signal when caller provides none", async () => {
    let capturedSignal: AbortSignal | null | undefined = null;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return new Response("ok");
    }) as typeof fetch;

    try {
      const client = createHttpClient();
      await client.fetch("https://example.com");

      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(capturedSignal!.aborted).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("uses caller signal when provided", async () => {
    const callerController = new AbortController();
    let capturedSignal: AbortSignal | null | undefined = null;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return new Response("ok");
    }) as typeof fetch;

    try {
      const client = createHttpClient();
      await client.fetch("https://example.com", { signal: callerController.signal });

      expect(capturedSignal).toBe(callerController.signal);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("passes url and options through to fetch", async () => {
    let capturedUrl: string | URL | Request = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response("ok");
    }) as typeof fetch;

    try {
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
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
