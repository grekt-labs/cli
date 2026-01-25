import type { HttpClient } from "@grekt-labs/cli-engine";

/**
 * Real HttpClient implementation using native fetch.
 * Used for HTTP requests to registries.
 */
export function createHttpClient(): HttpClient {
  return {
    fetch: (url: string, options?: RequestInit) => fetch(url, options),
  };
}

/**
 * Singleton instance for convenience.
 */
export const http = createHttpClient();
