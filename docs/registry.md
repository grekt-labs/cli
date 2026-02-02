# Registry & Sources

How artifact resolution and downloading works.

## Sources

grekt supports multiple artifact sources:

| Source | Format | Example |
|--------|--------|---------|
| Registry | `@scope/name` | `@grekt/tools` |
| GitHub | `github:owner/repo` | `github:user/my-artifact` |
| GitHub (with ref) | `github:owner/repo#ref` | `github:user/repo#v1.0.0` |
| GitLab | `gitlab:owner/repo` | `gitlab:user/my-artifact` |
| GitLab (self-hosted) | `gitlab:host/owner/repo` | `gitlab:gitlab.company.com/team/artifact` |
| GitLab (with ref) | `gitlab:host/owner/repo#ref` | `gitlab:gitlab.company.com/team/artifact#main` |

## Source Parsing

The source string is parsed to determine the type and identifier:

```typescript
parseSource("@grekt/tools")
// → { type: "registry", identifier: "@grekt/tools" }

parseSource("github:user/repo#v1.0.0")
// → { type: "github", identifier: "user/repo", ref: "v1.0.0" }

parseSource("gitlab:gitlab.mycompany.com/team/artifact")
// → { type: "gitlab", identifier: "team/artifact", host: "gitlab.mycompany.com" }
```

Code: `cli-engine/src/registry/sources.ts`

## Registry Resolution

For registry sources (`@scope/name`), the scope determines which registry to use:

```
@scope/name → lookup scope in config → get registry → download
```

**Resolution priority:**

1. Check `.grekt/config.yaml` for scope-specific registry
2. Fall back to public grekt registry

### Local Config (`.grekt/config.yaml`)

```yaml
registries:
  "@mycompany":
    type: gitlab
    host: gitlab.mycompany.com
    project: artifacts/registry
    token: glpat-xxxx  # Or use env var

  "@another":
    type: github
    project: my-org/artifacts
```

### Registry Types

| Type | Description | Default Host |
|------|-------------|--------------|
| `default` | Public grekt registry | registry.grekt.com |
| `gitlab` | GitLab Package Registry | gitlab.com |
| `github` | GitHub Container Registry (OCI) | ghcr.io |

## Token Priority

For authentication, tokens are resolved in this order:

1. **Config file token** (`.grekt/config.yaml` registries section)
2. **Environment variables**:
   - GitHub: `GITHUB_TOKEN` or `GH_TOKEN`
   - GitLab: `GITLAB_TOKEN` or `GL_TOKEN`

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          grekt add                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Source string                                                 │
│  ─────────────                                                 │
│        │                                                       │
│        ▼                                                       │
│  ┌──────────────┐                                              │
│  │ parseSource()│ (cli-engine)                                 │
│  └──────┬───────┘                                              │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────────────┐                                      │
│  │ ParsedSource         │                                      │
│  │ type: registry|github|gitlab                                │
│  │ identifier: ...      │                                      │
│  └──────┬───────────────┘                                      │
│         │                                                      │
│         ├── registry ──► resolveRegistry() ──► RegistryClient  │
│         │                                                      │
│         ├── github ────► buildGitHubTarballUrl() ──► download  │
│         │                                                      │
│         └── gitlab ────► buildGitLabArchiveUrl() ──► download  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Code Structure

```
cli/src/registry/
├── sources/
│   └── sources.ts        # downloadFromSource(), getSourceToken()
├── factory/
│   └── factory.ts        # resolveRegistry(), createRegistryClient()
├── api-client/
│   └── api-client.ts     # Public registry API client
└── registry.ts           # Exports

cli-engine/src/registry/
├── sources.ts            # parseSource() (pure)
├── resolver.ts           # resolveRegistry() (pure)
├── factory.ts            # createRegistryClient() (pure)
├── clients/
│   ├── default.ts        # Public registry client
│   └── gitlab.ts         # GitLab Package Registry client
└── download.ts           # downloadAndExtractTarball()
```

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `parseSource()` | cli-engine | Parse source string to ParsedSource |
| `resolveRegistry()` | cli-engine | Resolve scope to registry config |
| `createRegistryClient()` | cli-engine | Create client for registry type |
| `downloadFromSource()` | cli | Download artifact from any source |
| `getSourceToken()` | cli | Get token for a source (config + env) |

## Adding a New Registry Type

1. Add type to `RegistryType` in `cli-engine/src/registry/registry.types.ts`
2. Create client in `cli-engine/src/registry/clients/`
3. Update `createRegistryClient()` factory in `cli-engine/src/registry/factory.ts`
4. Add default host in `getDefaultHost()` in `cli-engine/src/registry/resolver.ts`

## Adding a New Source Type

1. Update `parseSource()` in `cli-engine/src/registry/sources.ts`
2. Update `ParsedSource` type in `cli-engine/src/registry/registry.types.ts`
3. Add download handler in `cli/src/registry/sources/sources.ts`
