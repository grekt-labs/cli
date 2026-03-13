import type { CustomTarget, ProjectConfig, LocalConfig } from "@grekt/engine";

export interface InitOptions {
  yes?: boolean;
  artifact?: boolean;
  targets?: string;
}

/**
 * Mutable state accumulated through the init wizard steps.
 * Each step reads what it needs and writes its results here.
 */
export interface InitState {
  projectRoot: string;
  manifestFields: Partial<ProjectConfig>;
  detectedTargets: string[];
  targets: string[];
  customTargets: Record<string, CustomTarget>;
  remoteSearch: boolean;
  localConfig: LocalConfig;
  scopesMissingTokens: string[];
}
