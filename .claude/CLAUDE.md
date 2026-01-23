# grekt CLI

## Terminology (MANDATORY)

**NEVER** use "package" or "pkg" anywhere in code, comments, docs, or conversation.

The correct term is **ARTIFACT**.

- `package.json` → OK (it's npm's file, not ours)
- `packageName` → **NO** → use `artifactName` or `artifactId`
- `pkg` → **NO** → use `artifact`
- "install the package" → **NO** → "install the artifact"

This is non-negotiable. grekt distributes artifacts, not packages.

## Naming (MANDATORY)

**NEVER** include the project name in function/variable/class names.

If tomorrow the project is called "patata" instead of "grekt", internal code shouldn't break.

- `grektConfig` → **NO** → use `config` or `projectConfig`
- `parseGrektYaml()` → **NO** → use `parseConfig()` or `parseManifest()`
- `GrektError` → **NO** → use `ConfigError`, `RegistryError`, etc.
- `isGrektInitialized()` → **NO** → use `isInitialized()`

**NEVER** include file formats in semantic function names.

Today it's markdown, tomorrow it could be anything. Name by purpose, not format.

- `parseMD()` → **NO** → use `parseArtifact()` or `parseComponent()`
- `loadYamlConfig()` → **NO** → use `loadConfig()` (format is implementation detail)
- `writeMarkdownFile()` → **NO** → use `writeArtifact()` or `writeComponent()`

**Exceptions (user-facing interfaces):**
- `GREKT_*` env vars → OK (external contract)
- `grekt.yaml`, `grekt.lock` → OK (file conventions)
- CLI binary name → OK (brand)
- Low-level I/O utilities → OK if truly generic (`readYaml`, `writeJson`)

Internal code must be project-name and format agnostic. Name by domain semantics.

---

## Architectural Principles

1. **Backend Agnosticism**: CLI doesn't know what's behind the API. Could be Supabase, custom, anything.
2. **Token Semantics**: CLI only transports tokens. Backend decides permissions.
3. **Lockfile Determinism**: `install` never rewrites `resolved`. Lockfile is snapshot.
4. **Single Protocol**: CLI only speaks API REST with registry.

## Sources

| Source | Example | Auth |
|--------|---------|------|
| Registry | `@scope/name` | Token (optional for public) |
| GitHub | `github:user/repo` | GITHUB_TOKEN (for private) |
| GitLab | `gitlab:user/repo` | GITLAB_TOKEN (for private) |

## Directory Structure

```
src/
├── commands/               # CLI commands (Commander.js)
│   ├── login.ts           # OAuth/token login
│   ├── logout.ts          # Remove credentials
│   ├── whoami.ts          # Show current user
│   ├── add.ts             # Add artifact
│   ├── install.ts         # Install from lockfile
│   ├── publish.ts         # Publish to registry
│   ├── deprecate.ts       # Mark version deprecated
│   └── undeprecate.ts     # Remove deprecation
├── lib/
│   ├── registry-client.ts # API client for registry
│   ├── registry.ts        # S3 legacy (backwards compat)
│   ├── credentials.ts     # Token storage
│   ├── config.ts          # grekt.yaml
│   ├── lockfile.ts        # grekt.lock
│   └── sources.ts         # Parse github:/gitlab:
├── schemas/               # Zod schemas
└── utils/                 # UI helpers
```

## Credentials

```yaml
# ~/.grekt/credentials.yaml
default:
  url: https://registry.grekt.com
  token: grk_xxxxxxxxxxxx
```

**Priority**: `GREKT_TOKEN` (env) > `credentials.yaml`

Token from ENV never persisted. `logout` only clears credentials.yaml.

## Environment Variables

- `GREKT_TOKEN` - Registry token (CI/CD, priority over file)
- `GITHUB_TOKEN` - GitHub private repos
- `GITLAB_TOKEN` - GitLab private repos

## Command Patterns

### Auth Required (publish, deprecate)
```typescript
const token = getRegistryToken()
if (!token) {
  error("Not logged in. Run 'grekt login' first.")
  process.exit(1)
}
```

### Informational (whoami) - always exit 0
```typescript
if (!token) {
  log("Not logged in")
  return  // exit 0, no error
}
```

## Lockfile: source vs resolved

- `source`: Original identifier (`@author/name`, `github:user/repo`)
- `resolved`: **Exact URL** used to download. Immutable after write.

`install` uses `resolved` directly without recalculation. This ensures deterministic installs.

## S3 Legacy Mode

Commands `publish`, `deprecate`, `undeprecate` support `--s3` flag for backwards compatibility with S3-compatible storage. This requires S3 credentials in `~/.grekt/credentials.yaml`:

```yaml
default:
  type: s3
  endpoint: https://...
  accessKeyId: ...
  secretAccessKey: ...
  bucket: ...
  publicUrl: https://... (optional)
```
