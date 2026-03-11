interface DashboardServer {
  port: number;
  url: string;
  stop: () => void;
  getUpsertedRegistries: () => Array<Record<string, unknown>>;
}

/**
 * Starts a local HTTP server that mocks PocketBase for dashboard tests.
 *
 * Endpoints:
 * - GET  /api/collections/:collection/records -> returns empty list (triggers create)
 * - POST /api/collections/:collection/records -> captures created record
 */
export async function startDashboardServer(): Promise<DashboardServer> {
  const upsertedRegistries: Array<Record<string, unknown>> = [];
  let idCounter = 0;

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);

      // List/find records (returns empty to trigger create on upsert)
      if (url.pathname.endsWith("/records") && request.method === "GET") {
        return Response.json({
          page: 1,
          perPage: 1,
          totalPages: 0,
          totalItems: 0,
          items: [],
        });
      }

      // Create record
      if (url.pathname.endsWith("/records") && request.method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        idCounter++;
        const record = {
          id: `rec${idCounter}`,
          collectionId: "col1",
          collectionName: url.pathname.split("/")[3],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          ...body,
        };

        if (url.pathname.includes("/registries/")) {
          upsertedRegistries.push(body);
        }

        return Response.json(record);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  return {
    port: server.port,
    url: `http://localhost:${server.port}`,
    stop: () => server.stop(),
    getUpsertedRegistries: () => upsertedRegistries,
  };
}
