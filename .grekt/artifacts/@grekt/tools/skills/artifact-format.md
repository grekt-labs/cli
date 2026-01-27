---
type: skill
name: artifact-format
description: Knowledge about grekt artifact structure and file formats.
---

# Grekt Artifact Format

## Artifact Structure

A grekt artifact is a folder containing:

```
artifact-name/
├── grekt.yaml          # Required: manifest file
├── agents/             # Optional: agent definitions
│   └── *.md
├── skills/             # Optional: skill definitions
│   └── *.md
└── commands/           # Optional: command definitions
    └── *.md
```

## Manifest File (grekt.yaml)

Required fields:
```yaml
name: artifact-name      # Identifier (no spaces, lowercase)
author: scope            # Without @ prefix
version: 1.0.0           # Semver format
```

Optional fields:
```yaml
description: What this artifact does
```

## Component Frontmatter

All component files (agents, skills, commands) must have YAML frontmatter:

```yaml
---
type: agent|skill|command
name: component-name
description: Brief description
---

# Content starts here
```

### Agent
Agents are AI assistants with specific expertise. They can use skills and respond to complex queries.

### Skill
Skills are reusable knowledge chunks. They can be used by agents or consumed as context by any AI.

### Command
Commands are quick actions invoked with `/command-name`. They provide immediate, specific responses.

## Naming Conventions

- **Artifact name**: lowercase, hyphens for spaces (`my-artifact`)
- **Author/scope**: lowercase, no special characters (`myorg`)
- **Component names**: lowercase, hyphens for spaces (`my-agent`)
- **Files**: match component name (`my-agent.md`)

## Version Bumping

Follow semver:
- **Patch** (1.0.x): Bug fixes, typo corrections
- **Minor** (1.x.0): New components, non-breaking changes
- **Major** (x.0.0): Breaking changes, major restructuring
