# grekt

AI artifacts versioned, synced, and shared across tools and teams.

> **Free to use.** grekt is free for personal and commercial use. If you're building something with it, we'd love to hear about it. The source is available under [BSL 1.1](./LICENSE), which just means you can't use this code to build something that competes with grekt. Each version converts to [MIT](./LICENSING.md) after two years.

## Installation

### Linux / macOS

```bash
curl -fsSL https://grekt.com/install.sh | sh
```

Or with custom options:

```bash
# Install specific version
GREKT_VERSION=2.3.4 curl -fsSL https://grekt.com/install.sh | sh

# Custom install directory
GREKT_INSTALL=/opt/bin curl -fsSL https://grekt.com/install.sh | sh
```

### macOS (Homebrew)

```bash
brew install grekt-labs/tap/grekt
```

## Quick Start

```bash
# Initialize a project
grekt init

# Add an artifact from the registry
grekt add @scope/artifact-name

# Install all artifacts from lockfile
grekt install

# Sync artifacts to your AI tools
grekt sync

# Check integrity and context budget
grekt check
```

For the full command reference, guides, and artifact format, visit the [documentation](https://docs.grekt.com).

## Development

### Requirements

- [Bun](https://bun.sh) >= 1.0

### Local setup

```bash
cd cli
bun install
bun link
```

Now `grekt` is available globally.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Feature requests and bug reports are welcome.

## License

[BSL 1.1](./LICENSE) — [What does this mean?](./LICENSING.md)
