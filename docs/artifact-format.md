# Artifact Format

How artifacts are structured and what each part means.

## Overview

An artifact is a directory containing a manifest (`grekt.yaml`) and component files.

```
@author/my-artifact/
├── grekt.yaml              # Manifest (required)
└── ... component files     # .md and .json files anywhere
```

**Structure is flexible.** You can organize files however you want - flat, nested, by category, by feature. The scanner recursively finds all `.md` and `.json` files regardless of directory structure.

More complex structures = slower scanning, so keep it reasonable.

## Manifest (grekt.yaml)

Every artifact needs a `grekt.yaml` at the root:

```yaml
name: "@your-scope/my-artifact"
version: 1.0.0
description: What this artifact does
keywords:
  - keyword1
  - keyword2
  - keyword3
author: Your Name  # Optional, for credits
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Artifact name. Use `@scope/name` format for publishable artifacts |
| `version` | Yes | Semver version |
| `description` | Yes | Short description |
| `keywords` | For publish | 3-5 keywords for discoverability |
| `author` | No | Optional credits/metadata |

**Name formats:**
- `@scope/name` - Scoped name (required for publishing). The scope determines which registry to use.
- `name` - Unscoped name (local use only, cannot be published)

## Categories

Components are categorized by their `grk-type`. Current categories:

| Category | Format | Purpose |
|----------|--------|---------|
| `agents` | .md | Autonomous specialists for complex tasks |
| `skills` | .md | Reusable capabilities |
| `commands` | .md | User-invoked actions |
| `mcps` | .json | MCP server configurations |
| `rules` | .json | Static rules/configurations |

**Categories are extensible.** Defined in `cli-engine/src/categories/categories.ts`. Adding a new category there propagates everywhere.

## Component Files

### Markdown Components (.md)

For `agents`, `skills`, and `commands`. Use YAML frontmatter with `grk-` prefixed fields:

```markdown
---
grk-type: skills
grk-name: do-something
grk-description: Does something useful
---

Instructions for the AI...
```

| Field | Required | Description |
|-------|----------|-------------|
| `grk-type` | Yes | One of: `agents`, `skills`, `commands` |
| `grk-name` | Yes | Component name |
| `grk-description` | Yes | What this component does |
| `grk-agents` | No | Associate with an agent (for skills/commands) |

**Why `grk-` prefix?**

Avoids collisions with other tools that use frontmatter (Jekyll, Hugo, etc.).

### JSON Components (.json)

For `mcps` and `rules`. Same fields but as JSON properties:

```json
{
  "grk-type": "mcps",
  "grk-name": "my-server",
  "grk-description": "MCP server for X",
  "command": "node",
  "args": ["server.js"]
}
```

The `grk-*` fields are metadata. Everything else is the actual content.

## Validation

When an artifact is scanned, files are validated:

- Has frontmatter (for .md) or valid JSON (for .json)
- Has required `grk-*` fields
- `grk-type` is a valid category
- Format matches allowed formats for the category

Invalid files are tracked in `invalidFiles` array but don't fail the scan.

## Auto-generated Fields

During `grekt publish` or `grekt pack`, the `components` section is auto-generated:

```yaml
name: "@your-scope/my-artifact"
version: 1.0.0
description: What this does
keywords: [keyword1, keyword2, keyword3]
components:                      # Auto-generated
  agents:
    - name: main-agent
      file: agents/main-agent.md
      description: Main agent description
  skills:
    - name: do-something
      file: skills/do-something.md
      description: Skill description
```

You don't write this section manually.

## Example: Minimal Artifact

**grekt.yaml:**
```yaml
name: "@myname/my-artifact"
version: 1.0.0
description: What it does
keywords: [keyword1, keyword2, keyword3]
```

**agent.md:**
```markdown
---
grk-type: agents
grk-name: my-agent
grk-description: Agent description
---

... agent instructions ...
```

## Common Mistakes

### 1. Missing frontmatter

```markdown
# My Skill

Instructions...
```

**Problem:** Files without YAML frontmatter are ignored by the scanner. They won't appear in the artifact's component list.

**Fix:** Add frontmatter block at the start:
```markdown
---
grk-type: skills
grk-name: my-skill
grk-description: What it does
---

Instructions...
```

### 2. Wrong `grk-type` for file format

```json
{
  "grk-type": "agents",
  ...
}
```

**Problem:** Each category has allowed formats. `agents`, `skills`, `commands` must be `.md`. While `mcps`, `rules` must be `.json`. Using the wrong format causes the file to be marked invalid.

**Fix:** Check `CATEGORY_CONFIG` in `cli-engine/src/categories/categories.ts` for allowed formats.

### 3. Using standard frontmatter fields instead of `grk-` prefix

```markdown
---
type: skills
name: something
description: Does stuff
---
```

**Problem:** grekt uses `grk-` prefixed fields to avoid collisions with other tools (Jekyll, Hugo, etc.) that also use frontmatter. Standard fields like `type`, `name`, `description` are ignored.

**Fix:** Always use the prefix:
```markdown
---
grk-type: skills
grk-name: something
grk-description: Does stuff
---
```
