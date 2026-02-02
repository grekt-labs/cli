# CLI Architecture

## What is grekt?

grekt manages AI tool configurations (artifacts) across repos, teams, and tools.

- **Control**: Track what's installed where, debug issues by version
- **Share**: Between teams or publicly, prevent config drift
- **Sync**: One artifact → multiple AI tools (Claude, Cursor, OpenCode), no vendor lock-in
- **Flexible**: Granular selection, lazy loading, GitHub/GitLab integration (including self-hosted)

## The Two Projects

```
┌─────────────────────────────────────────────────────────────────┐
│                         grekt ecosystem                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐           ┌─────────────────┐                │
│   │     cli     │  ──uses─► │   cli-engine    │                │
│   │   (grekt)   │           │ (@grekt-labs/   │                │
│   │             │           │   cli-engine)   │                │
│   └─────────────┘           └─────────────────┘                │
│         │                           │                           │
│         │                           │                           │
│    Has I/O:                    Pure logic:                      │
│    - File system               - Schemas                        │
│    - Network                   - Validation                     │
│    - User prompts              - Parsing                        │
│    - Terminal UI               - Formatting                     │
│                                - Resolution                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### cli (this repo)

The command-line tool users install and run. It handles:

- **Commands**: `grekt init`, `grekt add`, `grekt sync`, etc.
- **I/O operations**: Reading/writing files, network requests, user prompts
- **UI**: Terminal output, spinners, colors, interactive prompts
- **Platform specifics**: Environment variables, file paths, credentials

### cli-engine

A library with pure, deterministic logic. It has **no I/O** - all external operations are abstracted through interfaces. This makes it:

- **Testable**: Mock the interfaces instead of the filesystem
- **Portable**: Can run in CLI, browser, tests, or other contexts
- **Deterministic**: Same inputs always produce same outputs

## Why the Separation?

```
                    WITHOUT separation
┌─────────────────────────────────────────────────┐
│                     cli                         │
│  ┌───────────────────────────────────────────┐  │
│  │  Command logic + fs.readFile() + fetch()  │  │
│  │  + validation + parsing + UI + ...        │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Problem: Hard to test, tightly coupled         │
└─────────────────────────────────────────────────┘

                    WITH separation
┌─────────────────────────────────────────────────┐
│                     cli                         │
│  ┌───────────────────────────────────────────┐  │
│  │  Commands + I/O implementations + UI      │  │
│  │         │                                 │  │
│  │         ▼                                 │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │           cli-engine                │  │  │
│  │  │  Pure logic, receives interfaces    │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Benefit: Engine is testable and reusable       │
└─────────────────────────────────────────────────┘
```

## Dependency Injection: Hybrid Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (src/)                                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  context/                                             │  │
│  │  ├── fs              (singleton)                      │  │
│  │  ├── http            (singleton)                      │  │
│  │  ├── shell           (singleton)                      │  │
│  │  ├── cryptoProvider  (singleton)                      │  │
│  │  └── createTokenProvider()  (factory)                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│    Direct use in CLI:     │    Injected to cli-engine:      │
│    import { fs }          │    scanArtifact(fs, dir)        │
│    fs.exists(path)        │    validateTarball(shell, ...)  │
└───────────────────────────┴─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  cli-engine (pure)                                          │
│  - Receives interfaces: FileSystem, ShellExecutor, etc.     │
│  - No singletons                                            │
│  - 100% testable with mocks                                 │
└─────────────────────────────────────────────────────────────┘
```

**Why hybrid?**

1. **CLI**: Singletons for convenience — don't want to pass `fs` to 50 functions
2. **cli-engine**: Explicit injection — must be testable and portable
3. **context/engine.ts**: Wrappers that bridge both worlds

```typescript
// CLI: direct singleton use
import { fs } from "#/context";
fs.exists(path);

// CLI calling engine: passes singleton as argument
import { fs } from "#/context";
import { scanArtifact } from "@grekt-labs/cli-engine";
scanArtifact(fs, artifactDir);

// Engine: always receives interfaces, never imports singletons
export function scanArtifact(fs: FileSystem, dir: string) { ... }
```

## Core Interfaces

The engine exposes these interfaces (defined in `cli-engine/src/core/interfaces.ts`):

| Interface | Purpose |
|-----------|---------|
| `FileSystem` | File operations (read, write, mkdir, etc.) |
| `HttpClient` | Network requests |
| `ShellExecutor` | Running external commands |
| `TokenProvider` | Getting auth tokens (registry, GitHub, GitLab) |
| `PathConfig` | Project paths (root, config file, lockfile, etc.) |
| `EngineContext` | Bundle of all above interfaces |

The CLI implements these in `cli/src/context/`:

```
cli/src/context/
├── filesystem.ts   # FileSystem implementation
├── http.ts         # HttpClient implementation
├── shell.ts        # ShellExecutor implementation
├── tokens.ts       # TokenProvider implementation
├── engine.ts       # EngineContext builder
└── index.ts        # Exports
```

## Data Flow Example

When a user runs `grekt add @author/my-artifact`:

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. CLI receives command                                          │
│    └─► Commander.js parses args                                  │
│                                                                  │
│ 2. CLI prepares context                                          │
│    └─► Creates FileSystem, HttpClient, TokenProvider instances   │
│                                                                  │
│ 3. CLI calls engine functions with context                       │
│    └─► resolveArtifact(identifier, { fs, http, tokens })        │
│    └─► downloadArtifact(resolved, { fs, http })                 │
│    └─► updateLockfile(entry, { fs, paths })                     │
│                                                                  │
│ 4. CLI handles UI                                                │
│    └─► Shows spinner, success message, errors                    │
└──────────────────────────────────────────────────────────────────┘
```

## What Lives Where?

| Concern | Location | Why |
|---------|----------|-----|
| Command definitions | cli | User-facing, uses Commander.js |
| Zod schemas | cli-engine | Pure validation, reusable |
| File parsing (frontmatter, YAML) | cli-engine | Deterministic transformation |
| Registry resolution logic | cli-engine | Pure, no network calls itself |
| Actual HTTP requests | cli | I/O operation |
| Tarball extraction | cli-engine | Pure (receives buffer, returns files) |
| Terminal UI (spinners, colors) | cli | Platform-specific |
| Sync interfaces (`SyncPlugin`, `SyncResult`) | cli-engine | Contract that plugins implement |
| Sync constants (`GREKT_UNTRUSTED_TAG`, etc.) | cli-engine | Shared markers for content blocks |
| Sync plugins (Claude, Cursor, OpenCode) | cli | Actual implementation, writes to filesystem |

## Next Steps

- [Commands](./commands.md) - How CLI commands are structured
- [Sync System](./sync-system.md) - How artifacts sync to AI tools
- [Registry](./registry.md) - How artifact resolution works
