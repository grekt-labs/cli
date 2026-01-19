import type { InstalledYaml } from "../schemas/index.js";

export interface SyncResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

export interface SyncAdapter {
  name: string;
  targetFile: string;

  /**
   * Check if the target exists (e.g., .claude/ or .cursorrules)
   */
  targetExists(projectRoot: string): boolean;

  /**
   * Sync artifacts to the target
   */
  sync(installed: InstalledYaml, projectRoot: string, options: SyncOptions): Promise<SyncResult>;

  /**
   * Preview what would be synced (dry run)
   */
  preview(installed: InstalledYaml, projectRoot: string): SyncPreview;
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
