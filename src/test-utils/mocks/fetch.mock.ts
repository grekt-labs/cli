import { vi } from "vitest";

type FetchHandler = (
  url: string | URL | Request,
  init?: RequestInit,
) => Response | Promise<Response>;

/**
 * Replaces globalThis.fetch with a vi.fn() using the provided handler.
 * Returns a restore function that puts back the original fetch.
 */
export function createMockFetch(handler: FetchHandler): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(handler) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Creates a JSON Response with optional status code.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates an error Response with optional JSON body.
 */
export function errorResponse(
  status: number,
  body?: { error?: string; code?: string; message?: string; details?: string },
): Response {
  const responseBody = body ? JSON.stringify(body) : "";
  return new Response(responseBody, {
    status,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

/**
 * Creates a fetch-like object (not a real Response) matching the pattern
 * used in api-client tests where .ok and .json() are manually defined.
 *
 * This is needed because api-client.test.ts uses `as unknown as typeof fetch`
 * with objects that aren't real Response instances.
 */
export function createFetchLikeResponse(options: {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  statusText?: string;
}): { ok: boolean; status: number; statusText: string; json: () => Promise<unknown> } {
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    statusText: options.statusText ?? "",
    json: options.json ?? (async () => ({})),
  };
}
