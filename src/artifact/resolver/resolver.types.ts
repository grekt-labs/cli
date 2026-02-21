import type { LockfileEntry } from "@grekt-labs/cli-engine";

export interface ResolveOptions {
  projectRoot: string;
  version?: string;
}

export interface ResolveSuccess {
  success: true;
  artifactId: string;
  version: string;
  lockfileEntry: LockfileEntry;
  tempDir: string;
}

export interface ResolveFailure {
  success: false;
  error: string;
}

export type ResolveResult = ResolveSuccess | ResolveFailure;
