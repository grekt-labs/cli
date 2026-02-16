# Sync System

The sync system copies artifacts to AI tool-specific locations (`.claude/`, `.cursor/`, etc.).

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           grekt sync                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  .grekt/artifacts/              Target (e.g. .claude/)              │
│  ├── @author/tool-a/    ──►     ├── agents/                         │
│  │   ├── agent.md               │   └── author-tool-a-agent.md      │
│  │   └── skills/                ├── skills/                         │
│  │       └── do-x.md            │   └── author-tool-a-do-x/         │
│  └── @other/tool-b/             │       └── SKILL.md                │
│      └── ...                    └── CLAUDE.md (updated)             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Two Plugin Types

### FolderPlugin

Copies artifact files to category subfolders and updates a context entry point.

**Used by**: Claude, OpenCode, custom targets

```
.claude/
├── agents/           # Agent files
├── skills/           # Skill files (in subfolders)
├── commands/         # Command files
├── rules/            # Rule files
└── CLAUDE.md         # Context entry point (updated with grekt block)
```

### RulesOnlyPlugin

Only updates a single rules file. No file copying.

**Used by**: Cursor

```
.cursorrules          # Prepends grekt block to existing content
```

## Artifact Modes: CORE, CORE-SYM, and LAZY

Not all artifacts are copied to the target. The mode determines behavior:

| Mode | Files Synced | Method | In Index | Use Case |
|------|-------------|--------|----------|----------|
| **CORE** | Yes | Copy | Yes | Always in AI context |
| **CORE-SYM** | Yes | Symlink | Yes | Always in AI context, no duplication |
| **LAZY** | No | — | Yes | Discoverable, loaded on demand |

```yaml
# grekt.yaml
artifacts:
  "@author/always-needed": "^1.0.0"        # String = LAZY (default)
  "@author/critical-rules":
    version: "^2.0.0"
    mode: core                              # Explicit CORE (copy)
  "@author/dev-tools":
    version: "^1.0.0"
    mode: core-sym                          # CORE with symlinks
```

**LAZY mode** keeps artifacts discoverable (in `.grekt/index`) without consuming context tokens. The AI can request them when needed.

**CORE-SYM mode** works like CORE but creates symlinks instead of copies. This avoids file duplication and keeps target files always in sync with the artifact source. Note: if the artifact has content transformations (e.g., metadata injection), files are copied instead of symlinked.

## Built-in Plugins

| Plugin | Type | Target | Entry Point |
|--------|------|--------|-------------|
| `claude` | FolderPlugin | `.claude/` | `.claude/CLAUDE.md` |
| `cursor` | RulesOnlyPlugin | — | `.cursorrules` |
| `opencode` | FolderPlugin | `.opencode/` | — |

## Custom Targets

Define in `grekt.yaml`:

```yaml
targets:
  - claude
  - my-custom-tool

customTargets:
  my-custom-tool:
    name: "My Tool"
    contextEntryPoint: ".my-tool/context.md"
    # Optional: custom paths per category
    paths:
      agents: ".my-tool/agents"
      skills: ".my-tool/skills"
```

## File Naming

Artifact files are renamed to avoid collisions:

```
Original: @author/my-artifact/skills/do-something.md
Target:   .claude/skills/author-my-artifact-do-something/SKILL.md
```

The `getSafeFilename()` function handles this transformation.

## Context Entry Point

The entry point file (e.g., `CLAUDE.md`) gets a managed block prepended:

```markdown
**MANDATORY:** Read `.grekt/index` at session start to discover artifacts.

# Your existing content...
```

This block is only added once (detected by `GREKT_SECTION_HEADER`).

## When Things Happen

The sync system and index generation are **separate operations**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  grekt add / install / remove                                       │
│  └─► generateArtifactIndex()                                        │
│      └─► Writes .grekt/index with ALL artifacts (CORE + LAZY)       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  grekt sync                                                         │
│  └─► For each target (claude, cursor, etc.):                        │
│      └─► plugin.sync()                                              │
│          ├─► Copy/symlink CORE artifact files to target folders      │
│          └─► Update context entry point (CLAUDE.md, etc.)           │
└─────────────────────────────────────────────────────────────────────┘
```

**Key distinction:**
- **Index generation** (in add/install/remove): Creates `.grekt/index` with ALL artifacts for AI discoverability
- **Sync** (in sync command): Copies (or symlinks) only CORE/CORE-SYM mode files to AI tool folders

## Sync Command Flow

What happens when you run `grekt sync`:

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. Read lockfile + config                                          │
│    └─► Get installed artifacts and their modes                     │
│                                                                    │
│ 2. For each configured target (claude, cursor, etc.):              │
│    └─► Get plugin instance                                         │
│                                                                    │
│ 3. Plugin.sync() for each target:                                  │
│    ├─► Filter: only CORE/CORE-SYM mode artifacts                   │
│    ├─► scanArtifact() - categorize files by frontmatter            │
│    ├─► Copy or symlink files to target category folders            │
│    └─► Update context entry point (prepend grekt block)            │
└────────────────────────────────────────────────────────────────────┘
```

## Code Structure

```
cli/src/sync/
├── manager/
│   └── manager.ts       # Plugin registry, getPlugin(), getSyncPaths()
├── base/
│   └── base.ts          # createFolderPlugin(), createRulesOnlyPlugin()
├── plugins/
│   ├── claude/
│   │   └── claude.ts    # Claude-specific config
│   ├── cursor/
│   │   └── cursor.ts    # Cursor-specific config
│   └── opencode/
│       └── opencode.ts  # OpenCode-specific config
└── sync.types.ts        # Local type re-exports
```

## Adding a New Built-in Plugin

1. Create plugin file in `cli/src/sync/plugins/<name>/<name>.ts`
2. Use `createFolderPlugin()` or `createRulesOnlyPlugin()`
3. Register in `manager.ts`:
   - Add to `builtInConfigs`
   - Add to `builtInPlugins`
4. Export from plugin file

Example:

```typescript
// cli/src/sync/plugins/newTool/newTool.ts
import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const newToolPlugin = createFolderPlugin({
  id: "newtool",
  name: "New Tool",
  targetDir: ".newtool",
  contextEntryPoint: ".newtool/CONTEXT.md",
  generateRulesContent: generateDefaultBlockContent,
});
```

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getPlugin(target)` | manager.ts | Get plugin instance by name |
| `createFolderPlugin(config)` | base.ts | Factory for folder-based plugins |
| `createRulesOnlyPlugin(config)` | base.ts | Factory for rules-only plugins |
| `scanArtifact(fs, dir)` | cli-engine | Categorize artifact files |
| `getSafeFilename(artifactId, path)` | cli-engine | Generate collision-safe filename |
