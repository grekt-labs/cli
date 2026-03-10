<p align="center">
  <img src="https://github.com/grekt-labs/cli/raw/main/docs/grekt-banner.png" alt="grekt - Know your AI stack." width="100%" />
</p>

[![Snyk](https://snyk.io/test/github/grekt-labs/cli/badge.svg)](https://snyk.io/test/github/grekt-labs/cli)
[![Socket](https://socket.dev/api/badge/npm/package/@grekt/cli)](https://socket.dev/npm/package/@grekt/cli)

Local-first AI tooling infrastructure. Audit, manage, and secure MCPs, agents, skills, hooks, and commands across Claude Code, Cursor, and [more](https://docs.grekt.com) from your machine, with no cloud dependency.

> **Free to use.** grekt is free for personal and commercial use. The source is available under [BSL 1.1](./LICENSE), which means you can't use this code to build something that competes with grekt. Each version converts to [MIT](./LICENSING.md) after two years.

## Why grekt?

You are running AI tools you have never checked. Every time you install a skill from a registry, add an MCP server, or pull an agent config you are trusting code that has direct access to your editor, your files, and your workflow.

No sandbox. No review. No audit.
[20% of skills in public registries have been flagged as malicious](https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html).
84% of developers use AI tools daily, but only 29% trust what they're running. The gap between adoption and trust is growing. grekt closes it.

grekt gives you three things:

- **Visibility.** See every AI artifact in your projects. What it does, what it touches, whether anyone has actually checked it.
- **Verification.** Every artifact scanned for security risks and evaluated for quality. PASS, FAIL, or WARN -- no ambiguity.
- **Control.** Lock versions. Pin hashes. Sync verified configurations across your team. Your tools, your machine, your rules.

## Installation

### Linux / macOS

```bash
curl -fsSL https://cli.grekt.com/install.sh | sh
```

### macOS (Homebrew)

```bash
brew install grekt-labs/tap/grekt
```

### npm

```bash
npm install -g @grekt/cli
```

## Quick Start

```bash
grekt init                        # Initialize a project
grekt add @scope/artifact-name    # Add an artifact
grekt install                     # Install from lockfile
grekt sync                        # Sync to your AI tools
```

### Verify your stack

```bash
grekt scan                        # Scan artifacts for security risks
grekt eval                        # Evaluate artifact quality and behavior
grekt check                       # Check lockfile integrity and drift
```

### Manage artifacts

```bash
grekt list                        # List installed artifacts
grekt outdated                    # Check for available updates
grekt upgrade                     # Upgrade artifacts
grekt trust @scope/artifact       # Mark an artifact as trusted
```

Artifacts can come from:

- Your **self-hosted** registry on [GitHub](https://grekt.com/en-US/docs/guide/sources/github.html) or [GitLab](https://grekt.com/en-US/docs/guide/sources/gitlab.html)
- The [public registry](https://explore.grekt.com) (`@scope/name`)
- Official repos on GitHub (`github:user/repo`) or GitLab (`gitlab:host/user/repo`)
- A local path on your machine (`./path`)

### Supported tools

grekt syncs to Claude Code, Cursor, Windsurf, Cline, GitHub Copilot, Aider, Continue, OpenCode, Amazon Q, and any tool following the [agentskills.io](https://agentskills.io) standard.

For the full command reference and guides, visit the [documentation](https://docs.grekt.com).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Feature requests and bug reports are welcome.

## License

[BSL 1.1](./LICENSE) -- [What does this mean?](./LICENSING.md)
