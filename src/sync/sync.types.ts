import type { Lockfile } from "@grekt-labs/cli-engine";

export interface SyncResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
  createTarget?: boolean;
}

export interface SyncPreview {
  willCreate: string[];
  willUpdate: string[];
  willSkip: string[];
}

export interface SyncPlugin {
  /** Plugin identifier (e.g., "claude", "cursor") */
  id: string;

  /** Display name (e.g., "Claude", "Cursor") */
  name: string;

  /** Target file or directory (e.g., ".claude", ".cursorrules") */
  targetFile: string;

  /** Check if the target exists */
  targetExists(projectRoot: string): boolean;

  /** Sync artifacts to the target */
  sync(lockfile: Lockfile, projectRoot: string, options: SyncOptions): Promise<SyncResult>;

  /** Preview what would be synced (dry run) */
  preview(lockfile: Lockfile, projectRoot: string): SyncPreview;
}
