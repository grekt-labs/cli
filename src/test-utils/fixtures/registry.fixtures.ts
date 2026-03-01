/**
 * Supabase response shape builders for registry tests.
 */

export interface VersionRow {
  version: string;
  deprecated_message: string | null;
  published_at: string;
}

export interface ArtifactRow {
  id: string;
  created_at: string;
}

export function createArtifactRow(
  overrides: Partial<ArtifactRow> = {},
): ArtifactRow {
  return {
    id: "@org/tool",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createVersionRow(
  overrides: Partial<VersionRow> = {},
): VersionRow {
  return {
    version: "1.0.0",
    deprecated_message: null,
    published_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createVersionList(
  versions: Array<Partial<VersionRow>>,
): { data: VersionRow[]; error: null } {
  return {
    data: versions.map(createVersionRow),
    error: null,
  };
}
