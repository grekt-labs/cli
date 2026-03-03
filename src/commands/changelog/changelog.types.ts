import type { BumpType } from "@grekt/engine";
import type { WorkspaceArtifact } from "@grekt/engine";

export interface ConventionalCommit {
  hash: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  message: string;
  raw: string;
}

export interface ArtifactChangelog {
  artifact: WorkspaceArtifact;
  commits: ConventionalCommit[];
  calculatedBump: BumpType;
  changedFiles: string[];
}

export interface ChangelogOptions {
  ci?: boolean;
  format?: "changeset" | "json" | "yaml";
  since?: string;
  dryRun?: boolean;
}
