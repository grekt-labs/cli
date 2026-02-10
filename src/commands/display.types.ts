export interface ComponentSummaryParams {
  artifactId: string;
  version: string;
  action: string;
  keywords?: string[];
  scanned: {
    agent?: unknown;
    skills: unknown[];
    commands: unknown[];
    mcps: unknown[];
    rules: unknown[];
  };
  componentCount: number;
}
