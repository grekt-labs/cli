# grekt

CLI for managing AI artifacts (agents, skills, commands) that sync to Claude, Cursor, and other AI tools.

## Installation

### Linux / macOS

```bash
curl -fsSL https://grekt.dev/install.sh | sh
```

Or with custom options:

```bash
# Install specific version
GREKT_VERSION=2.3.4 curl -fsSL https://grekt.dev/install.sh | sh

# Custom install directory
GREKT_INSTALL=/opt/bin curl -fsSL https://grekt.dev/install.sh | sh
```

### macOS (Homebrew)

```bash
brew install grekt-labs/tap/grekt
```

## Development

### Requirements

- [Bun](https://bun.sh) >= 1.0

### Local installation

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

# Add an artifact from registry
grekt add my-artifact

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
| `grekt add <artifact>` | Add artifact from registry |
| `grekt remove <id>` | Remove an artifact |
| `grekt sync` | Sync to AI tools (Claude, Cursor) |
| `grekt list` | List installed artifacts |
| `grekt check` | Check integrity and context budget |
| `grekt config` | Manage configuration |

## Configuration

Set `REGISTRY_URL` in your environment or `.env` file to point to your artifact registry.

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
