// Mock factories
export {
  createMockSupabase,
  createMockSession,
  createSessionMockFactory,
  type SupabaseHandlers,
  type SessionModuleOverrides,
} from "./mocks/supabase.mock";

export {
  createMockContextFs,
  createMockProjectConfig,
  type MockContextFs,
  type MockProjectConfig,
} from "./mocks/context.mock";

export {
  createMockFetch,
  jsonResponse,
  errorResponse,
  createFetchLikeResponse,
} from "./mocks/fetch.mock";

export {
  createMockInquirer,
  createMockSearchableCheckbox,
  type MockInquirer,
} from "./mocks/prompts.mock";

export { createMockUI } from "./mocks/ui.mock";

export {
  createMockSpawn,
  type MockSpawn,
} from "./mocks/child-process.mock";

export {
  suppressConsole,
  spyOnConsole,
  spyOnProcessExit,
  spyOnProcessExitThrowing,
} from "./mocks/console.mock";

// Fixtures
export {
  createValidatedArtifact,
  createTarballResult,
  createValidationError,
  createValidationSuccess,
} from "./fixtures/artifact.fixtures";

export {
  createArtifactRow,
  createVersionRow,
  createVersionList,
  type VersionRow,
  type ArtifactRow,
} from "./fixtures/registry.fixtures";
