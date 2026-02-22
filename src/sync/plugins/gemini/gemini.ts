import type { SyncPlugin } from "#/sync/sync.types";
import { globalPlugin } from "#/sync/plugins/universal/universal";

export const geminiPlugin: SyncPlugin = {
  ...globalPlugin,
  id: "gemini",
  name: "Gemini CLI",
};

export { geminiMcpConfig } from "./gemini.mcp";
