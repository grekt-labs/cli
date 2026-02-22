import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const julesPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "jules",
  name: "Jules",
};
