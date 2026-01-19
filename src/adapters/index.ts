import type { SyncAdapter } from "./interface.js";
import type { SyncTarget } from "../schemas/index.js";
import { claudeAdapter } from "./claude.js";
import { cursorAdapter } from "./cursor.js";
import { windsurfAdapter } from "./windsurf.js";

export * from "./interface.js";
export { claudeAdapter } from "./claude.js";
export { cursorAdapter } from "./cursor.js";
export { windsurfAdapter } from "./windsurf.js";

const adapters: Record<SyncTarget, SyncAdapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
  windsurf: windsurfAdapter,
};

export function getAdapter(target: SyncTarget): SyncAdapter {
  return adapters[target];
}

export function getAdapters(targets: SyncTarget[]): SyncAdapter[] {
  return targets.map((t) => adapters[t]);
}
