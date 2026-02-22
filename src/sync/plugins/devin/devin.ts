import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const devinPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "devin",
  name: "Devin",
};
