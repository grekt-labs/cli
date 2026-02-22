import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const ampPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "amp",
  name: "Amp",
};

export { ampMcpConfig } from "./amp.mcp";
