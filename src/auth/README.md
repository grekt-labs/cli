# Auth Module - Technical Decision

## Current State: Supabase Lock-in (Intentional)

This module is **intentionally coupled to Supabase** as a trade-off for validation speed.

### Why

- **Speed over abstraction**: Supabase provides auth, OAuth, and session management out of the box
- **Zero backend effort**: No need to build custom auth infrastructure for MVP
- **Validation phase**: If the project doesn't gain traction, the abstraction work would be wasted

### Lock-in Scope

The coupling is **contained** to ~10 files, not scattered across the codebase:

| File | Coupling Type |
|------|---------------|
| `auth/session/session.ts` | Direct Supabase SDK imports, `getSupabaseClient()` |
| `auth/oauth/oauth.ts` | Supabase OAuth flow (`signInWithOAuth`, `exchangeCodeForSession`) |
| `registry/api-client/api-client.ts` | Direct DB queries via Supabase SDK |
| `registry/publishers/api-publisher.ts` | Checks `isSupabaseConfigured()` |
| `commands/whoami.ts` | Uses `getSupabaseClient()` directly |
| `commands/logout.ts` | Uses `supabase.auth.signOut()` |
| `commands/login.ts` | Depends on Supabase OAuth module |
| `commands/deprecate.ts` | Mixed adapter + Supabase API |
| `commands/undeprecate.ts` | Mixed adapter + Supabase API |

### What's Already Well Abstracted

The **registry layer** follows proper hexagonal architecture:

```
src/registry/
├── registry.types.ts       # Port interface
├── factory/                # Factory pattern
├── clients/
│   ├── default/            # HTTP-based (portable)
│   └── gitlab/             # GitLab adapter
└── publishers/
    ├── publisher.types.ts  # Port interface
    ├── s3-publisher.ts     # S3 adapter
    └── custom-publisher.ts # Router
```

This pattern should be replicated for auth when migration is needed.

---

## Migration Plan (When Needed)

If the project gains traction and requires migration away from Supabase:

### Step 1: Create Auth Provider Interface

```typescript
// auth/provider/provider.types.ts
export interface AuthProvider {
  isConfigured(): boolean;
  getUser(): Promise<{ email: string; id: string } | null>;
  signInWithOAuth(provider: string): Promise<{ url: string }>;
  signInWithPassword(email: string, password: string): Promise<void>;
  exchangeCodeForSession(code: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<{ access_token: string; refresh_token?: string } | null>;
}
```

### Step 2: Create Supabase Adapter

```
src/auth/
├── provider.types.ts           # Interface (Port)
├── providers/
│   └── supabase/
│       └── supabase.ts         # Move current code here
├── session/session.ts          # Use injected AuthProvider
└── oauth/oauth.ts              # Use injected AuthProvider
```

### Step 3: Update Consumers

Update the ~10 files to use the `AuthProvider` interface instead of direct Supabase imports.

### Estimated Effort

- Interface creation: ~1 hour
- Move code to adapter: ~2-3 hours
- Update imports in 10 files: ~1-2 hours
- **Total: ~1 day focused work**

---

## Known Deviations from Backend Policy

The current implementation has these deviations from `CLAUDE.md` Backend Policy:

| Policy Rule | Current State | Risk Level |
|-------------|---------------|------------|
| "No direct writes to DB without passing through logic" | `api-client.ts` has direct Supabase queries | Medium |
| "RLS as only authorization layer is prohibited" | RLS handles ownership checks | Medium |
| "Verify JWT explicitly in backend" | Delegated to Supabase SDK | Low |

These are acceptable for validation but should be addressed before scaling with sensitive user data.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-XX | Accept Supabase lock-in for auth | Speed > abstraction for MVP validation |
| TBD | Migrate to adapter pattern | If project gains traction |
