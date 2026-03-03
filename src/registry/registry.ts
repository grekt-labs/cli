// Registry domain barrel export
// Re-export from cli-engine for backwards compatibility
export {
  // Types
  type RegistryType,
  type ResolvedRegistry,
  type DownloadResult,
  type PublishResult,
  type RegistryClient,
  type LocalConfig,
  type RegistryEntry,
  type SourceType,
  type ParsedSource,
  type DownloadOptions,
  type TarballDownloadResult,
  // Resolver
  parseArtifactId,
  getDefaultHost,
  // Sources
  parseSource,
  getSourceDisplayName,
  // Download utilities
  buildGitHubTarballUrl,
  buildGitLabArchiveUrl,
  getGitHubHeaders,
  getGitLabHeaders,
} from "@grekt/engine";

// CLI-specific exports (with injected dependencies)
export { resolveRegistry, createRegistryClient } from "./factory/factory";
export { downloadFromSource, getSourceToken } from "./sources/sources";
// Note: clients, metadata, and api-client have specific implementations
// Import directly when needed to avoid export conflicts
