import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const codexPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "codex",
  name: "Codex",
};
