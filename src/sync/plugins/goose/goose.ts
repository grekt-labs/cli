import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const goosePlugin: SyncPlugin = {
  ...globalPlugin,
  id: "goose",
  name: "Goose",
};
