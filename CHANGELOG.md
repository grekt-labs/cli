# [2.1.0](https://github.com/grekt-labs/cli/compare/v2.0.0...v2.1.0) (2026-01-25)


### Features

* force release after CI fixes ([a2426e4](https://github.com/grekt-labs/cli/commit/a2426e439dcbe38e8bc3837e076f6983e1cbf65e))

# [2.0.0](https://github.com/grekt-labs/cli/compare/v1.0.0...v2.0.0) (2026-01-24)


* refactor!: unify configuration in project-level .grekt/config.yaml ([824b950](https://github.com/grekt-labs/cli/commit/824b950b2cb6b0431c79b5e326c22ef693d502d7))


### BREAKING CHANGES

* All commands now require project initialization.
Global ~/.grekt/ directory is no longer used.

- Add session and tokens storage to LocalConfig schema
- Move OAuth session from ~/.grekt/session.yaml to .grekt/config.yaml
- Move git source tokens to .grekt/config.yaml tokens section
- Add setProjectRoot() to session module for project context
- Add writeLocalConfigWithComments() for self-documenting YAML
- Update all auth commands to require isInitialized()
- Delete global credentials module
- Remove GLOBAL_CONFIG_DIR from paths

New .grekt/config.yaml schema:
  registries: scope-to-backend mappings
  session: OAuth session (access_token, refresh_token, expires_at)
  tokens: git source tokens (github, gitlab.com, etc.)

Token priority unchanged: env vars > config file

# [1.0.0](https://github.com/grekt-labs/cli/compare/v0.4.0...v1.0.0) (2026-01-24)


* refactor!: reorganize codebase to domain-driven architecture ([a272c24](https://github.com/grekt-labs/cli/commit/a272c24fb5eb3c8c13dd20ae8abe3c8b0b5ff8d4))


### BREAKING CHANGES

* All import paths from lib/, plugins/, and utils/
have changed. Update imports to use new domain paths:
- lib/config → config/project
- lib/paths → config/paths
- lib/artifact, integrity, lockfile, check → artifact/
- lib/credentials, supabase → auth/
- lib/registry/*, sources, metadata → registry/
- lib/plugins, plugins/* → sync/
- utils/ui → shared/ui

- ca

# [0.4.0](https://github.com/grekt-labs/cli/compare/v0.3.3...v0.4.0) (2026-01-23)


### Features

* **check:** add autoCheck option and refactor check module ([40bedd1](https://github.com/grekt-labs/cli/commit/40bedd141e1f0d89a8e37210d13db6f64e770f68))

## [0.3.3](https://github.com/grekt-labs/cli/compare/v0.3.2...v0.3.3) (2026-01-23)


### Bug Fixes

* **ci:** remove @semantic-release/github to avoid duplicate releases ([201c416](https://github.com/grekt-labs/cli/commit/201c4161a581d62ef508acf0306b454df541cac0))

## [0.3.3](https://github.com/grekt-labs/cli/compare/v0.3.2...v0.3.3) (2026-01-23)


### Bug Fixes

* **ci:** use gh CLI instead of action for external releases ([64f911a](https://github.com/grekt-labs/cli/commit/64f911aa0bc5d9666cd3ca3a7459d64fdd8a6877))

## [0.3.1](https://github.com/grekt-labs/cli/compare/v0.3.0...v0.3.1) (2026-01-23)


### Bug Fixes

* **ci:** use Node 22 for semantic-release ([f695191](https://github.com/grekt-labs/cli/commit/f6951914d381879960509e75fbc14ee4b0380da9))
