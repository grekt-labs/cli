import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const zedPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "zed",
  name: "Zed",
};
