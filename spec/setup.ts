import { afterAll, beforeAll } from "vitest";
import { registerArtifact, startRegistryServer } from "./helpers/registry-server";
import { cleanTarballCache } from "./helpers/fixtures";

let registryServer: { port: number; url: string; stop: () => void };

/**
 * Global setup: starts mock registry server and pre-builds fixture tarballs.
 * Import this in spec files that need registry access.
 */
beforeAll(async () => {
  registerArtifact("test/artifact", "1.0.0", "test-artifact");
  registryServer = await startRegistryServer();
});

afterAll(() => {
  registryServer?.stop();
  cleanTarballCache();
});

export function getRegistryUrl(): string {
  return registryServer.url;
}
