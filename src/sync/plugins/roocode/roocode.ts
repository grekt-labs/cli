import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const roocodePlugin: SyncPlugin = {
  ...globalPlugin,
  id: "roocode",
  name: "RooCode",
};

export { roocodeMcpConfig } from "./roocode.mcp";
