import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const kilocodePlugin: SyncPlugin = {
  ...globalPlugin,
  id: "kilocode",
  name: "Kilo Code",
};

export { kilocodeMcpConfig } from "./kilocode.mcp";
