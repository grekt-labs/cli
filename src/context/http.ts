import type { HttpClient } from "@grekt/engine";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Real HttpClient implementation using native fetch.
 * Applies a default timeout to all requests unless the caller provides its own signal.
 */
export function createHttpClient(): HttpClient {
  return {
    fetch: (url: string, options?: RequestInit) => {
      const signal =
        options?.signal ?? AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS);
      return fetch(url, { ...options, signal });
    },
  };
}

/**
 * Singleton instance for convenience.
 */
export const http = createHttpClient();
