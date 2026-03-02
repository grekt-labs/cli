import type { BumpType } from "@grekt-labs/cli-engine";
import type { WorkspaceArtifact } from "@grekt-labs/cli-engine";

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
