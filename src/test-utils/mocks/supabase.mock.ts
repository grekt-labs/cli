import { vi } from "vitest";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

interface QueryResponse<T = unknown> {
  data: T | null;
  error: Error | null;
}

interface TableHandlers {
  single?: QueryResponse;
  list?: QueryResponse;
  update?: QueryResponse;
}

export interface SupabaseHandlers {
  artifacts?: TableHandlers;
  versions?: TableHandlers;
  auth?: {
    getUser?: QueryResponse<{ user: { email: string } | null }>;
  };
  [table: string]: TableHandlers | { getUser?: QueryResponse } | undefined;
}

function createQuery(table: string, handlers: SupabaseHandlers) {
  const tableHandlers = handlers[table] as TableHandlers | undefined;
  const query = {
    eq: () => query,
    single: async () => tableHandlers?.single ?? { data: null, error: null },
    then: (
      resolve: (value: QueryResponse) => void,
      reject: (reason?: unknown) => void,
    ) => {
      Promise.resolve(
        tableHandlers?.list ?? { data: null, error: null },
      ).then(resolve, reject);
    },
  };
  return query;
}

function createUpdateQuery(table: string, handlers: SupabaseHandlers) {
  const tableHandlers = handlers[table] as TableHandlers | undefined;
  const query = {
    eq: () => query,
    then: (
      resolve: (value: QueryResponse) => void,
      reject: (reason?: unknown) => void,
    ) => {
      Promise.resolve(
        tableHandlers?.update ?? { data: null, error: null },
      ).then(resolve, reject);
    },
  };
  return query;
}

export function createMockSupabase(
  handlers: SupabaseHandlers = {},
): Pick<SupabaseClient, "from" | "auth"> {
  return {
    from: (table: string) => ({
      select: () => createQuery(table, handlers),
      update: () => createUpdateQuery(table, handlers),
    }),
    auth: {
      getUser: async () =>
        handlers.auth?.getUser ?? { data: { user: null }, error: null },
    },
  } as unknown as Pick<SupabaseClient, "from" | "auth">;
}

export function createMockSession(
  accessToken: string,
): Pick<Session, "access_token"> {
  return { access_token: accessToken };
}

export interface SessionModuleOverrides {
  supabase?: ReturnType<typeof createMockSupabase>;
  session?: Pick<Session, "access_token"> | null;
  supabaseUrl?: string;
}

/**
 * Creates the vi.mock factory for #/auth/session/session.
 *
 * Usage with module-level variables:
 * ```ts
 * let mockSupabase = createMockSupabase();
 * let mockSession: Pick<Session, "access_token"> | null = null;
 *
 * vi.mock("#/auth/session/session", async (importOriginal) => ({
 *   ...(await importOriginal()),
 *   getSupabaseClient: () => mockSupabase,
 *   getSession: () => mockSession,
 *   getSupabaseUrl: () => "https://supabase.test",
 * }));
 * ```
 */
export function createSessionMockFactory(
  getOverrides: () => SessionModuleOverrides,
) {
  return async (importOriginal: () => Promise<Record<string, unknown>>) => ({
    ...(await importOriginal()),
    getSupabaseClient: () =>
      getOverrides().supabase ?? createMockSupabase(),
    getSession: () => getOverrides().session ?? null,
    getSupabaseUrl: () =>
      getOverrides().supabaseUrl ?? "https://supabase.test",
  });
}
