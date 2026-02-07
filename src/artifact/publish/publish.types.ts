export interface ValidatedArtifact {
  artifactId: string;
  scope: string;
  fullPath: string;
  manifest: {
    version: string;
    description?: string;
    keywords?: string[];
    private?: boolean;
  };
  scanned: {
    agent?: unknown;
    skills: unknown[];
    commands: unknown[];
    mcps: unknown[];
    rules: unknown[];
  };
  componentCount: number;
}

export interface ValidateResult {
  artifact: ValidatedArtifact;
  components: unknown[];
}

export interface PrepareResult {
  artifact: ValidatedArtifact;
  tarballPath: string;
  tarballFilename: string;
  tarballSize: number;
}

export interface PublishResult {
  success: boolean;
  error?: string;
  url?: string;
}
