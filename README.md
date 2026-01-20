# grekt

CLI for managing AI artifacts (agents, skills, commands) that sync to Claude, Cursor, and other AI tools.

## Requirements

- [Bun](https://bun.sh) >= 1.0

## Installation (local development)

```bash
cd cli
bun install
bun link
```

Now `grekt` is available globally.

## Quick Start

```bash
# Initialize a project
grekt init

# Add an artifact from GitHub
grekt add github:grekt-labs/artifacts/@grekt/code-reviewer

# Sync to your AI tools
grekt sync

# Check integrity
grekt check

# List installed artifacts
grekt list
```

## Commands

| Command | Description |
|---------|-------------|
| `grekt init` | Initialize grekt in current directory |
| `grekt add <source>` | Add artifact from GitHub |
| `grekt remove <id>` | Remove an artifact |
| `grekt sync` | Sync to AI tools (Claude, Cursor) |
| `grekt list` | List installed artifacts |
| `grekt check` | Check integrity and context budget |
| `grekt config` | Manage configuration |

## GitHub Source Formats

```bash
# Short format
grekt add github:owner/repo/@scope/artifact

# URL format
grekt add https://github.com/owner/repo/tree/main/@scope/artifact
```

## Project Structure

After `grekt init`, your project will have:

```
project/
├── .grekt/
│   └── config.yaml      # Sync targets
├── grekts/
│   └── installed.yaml   # Installed artifacts index
└── grekt.lock           # Version lockfile
```

## Artifact Format

Artifacts are directories with:

```
@scope/artifact-name/
├── grekt.yaml           # Manifest (name, author, version)
├── agent.md             # Optional agent definition
├── skills/
│   └── *.md             # Skill files
└── commands/
    └── *.md             # Command files
```

Each `.md` file needs YAML frontmatter:

```markdown
---
type: agent|skill|command
name: my-component
description: What it does
---

Content here...
```

## License

MIT
