import { readFileSync } from "fs";
import { buildFixtureTarball } from "./fixtures";

interface RegistryServer {
  port: number;
  url: string;
  stop: () => void;
}

// Registered artifacts: key = "scope/name@version", value = fixture name
const registeredArtifacts = new Map<string, string>();

/**
 * Register a fixture artifact to be served by the mock registry.
 * Call before starting the server.
 */
export function registerArtifact(artifactId: string, version: string, fixtureName: string): void {
  registeredArtifacts.set(`${artifactId}@${version}`, fixtureName);
}

/**
 * Starts a local HTTP server that mocks the grekt registry.
 *
 * Endpoints:
 * - GET /functions/v1/download?artifact=X&version=Y -> returns { url } pointing to tarball
 * - GET /tarball/:fixtureName.tar.gz -> serves the tarball bytes
 */
export async function startRegistryServer(): Promise<RegistryServer> {
  // Pre-build tarballs for all registered artifacts
  const tarballPaths = new Map<string, string>();
  for (const [key, fixtureName] of registeredArtifacts) {
    tarballPaths.set(key, buildFixtureTarball(fixtureName));
  }

  const server = Bun.serve({
    port: 0, // Random available port
    fetch(request) {
      const url = new URL(request.url);

      // Download endpoint (mimics edge function)
      if (url.pathname === "/functions/v1/download") {
        const artifact = url.searchParams.get("artifact");
        const version = url.searchParams.get("version");

        if (!artifact || !version) {
          return Response.json(
            { error: "Missing artifact or version parameter" },
            { status: 400 }
          );
        }

        // Normalize: CLI sends "@scope/name" but we register "scope/name"
        const normalizedArtifact = artifact.startsWith("@") ? artifact.slice(1) : artifact;
        const key = `${normalizedArtifact}@${version}`;
        const fixtureName = registeredArtifacts.get(key);

        if (!fixtureName) {
          return Response.json(
            { error: "Artifact not found in registry", code: "ARTIFACT_NOT_FOUND" },
            { status: 404 }
          );
        }

        const tarballUrl = `http://localhost:${server.port}/tarball/${fixtureName}.tar.gz`;
        return Response.json({ url: tarballUrl });
      }

      // Tarball serving endpoint
      if (url.pathname.startsWith("/tarball/")) {
        const filename = url.pathname.replace("/tarball/", "").replace(".tar.gz", "");
        const tarballPath = buildFixtureTarball(filename);

        try {
          const data = readFileSync(tarballPath);
          return new Response(data, {
            headers: { "Content-Type": "application/gzip" },
          });
        } catch {
          return new Response("Tarball not found", { status: 404 });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  return {
    port: server.port,
    url: `http://localhost:${server.port}/functions/v1`,
    stop: () => server.stop(),
  };
}
