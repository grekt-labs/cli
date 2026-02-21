import type { LockfileEntry } from "@grekt-labs/cli-engine";

export type ReconcileAction = "keep" | "resolve" | "prune";

export interface ReconcileEntry {
  artifactId: string;
  action: ReconcileAction;
  lockfileEntry?: LockfileEntry;
  source: string;
  configVersion?: string;
  reason: string;
}

export interface ReconcileResult {
  toKeep: ReconcileEntry[];
  toResolve: ReconcileEntry[];
  toPrune: ReconcileEntry[];
}
