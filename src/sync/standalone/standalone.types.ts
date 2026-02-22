import type { Category, ScannedFile, InvalidFile } from "@grekt-labs/cli-engine";

export interface StandaloneSyncOptions {
  sourceDir: string;
  artifactId: string;
  targets: string[];
  projectRoot: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface StandaloneSyncResult {
  artifactId: string;
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
}

export interface ScanResult {
  files: Record<Category, ScannedFile[]>;
  invalidFiles: InvalidFile[];
}
