import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const warpPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "warp",
  name: "Warp",
};
