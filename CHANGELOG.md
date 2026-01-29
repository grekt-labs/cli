## [4.4.3](https://github.com/grekt-labs/cli/compare/v4.4.2...v4.4.3) (2026-01-29)


### Bug Fixes

* remove unwanted error ([1af77c9](https://github.com/grekt-labs/cli/commit/1af77c9d41f5be0340bb667c60b61f835bdac7a1))

## [4.4.2](https://github.com/grekt-labs/cli/compare/v4.4.1...v4.4.2) (2026-01-29)


### Bug Fixes

* undo conventional commits detector ([b81f657](https://github.com/grekt-labs/cli/commit/b81f6576aaaeedc15b7092f9ddbdec73fbdf64b8))

## [4.4.1](https://github.com/grekt-labs/cli/compare/v4.4.0...v4.4.1) (2026-01-29)


### Bug Fixes

* restore semantic-release for CLI releases ([1015c6d](https://github.com/grekt-labs/cli/commit/1015c6d25aa35c2ed44b30873a4a705dac3242e6))
* trigger release ([382aae5](https://github.com/grekt-labs/cli/commit/382aae5510a311ebe6ff6abee04813c2cbf80b4d))
* **version:** run multi-semantic-release as subprocess ([b6dfe28](https://github.com/grekt-labs/cli/commit/b6dfe287d30fa8442524db960330729f5b02f474))

# [4.4.0](https://github.com/grekt-labs/cli/compare/v4.3.0...v4.4.0) (2026-01-28)


### Features

* **version:** add manual bump support (patch/minor/major) ([a168e04](https://github.com/grekt-labs/cli/commit/a168e0473fbdfddaeae85b7dece0c8eb422d0f01))

# [4.3.0](https://github.com/grekt-labs/cli/compare/v4.2.1...v4.3.0) (2026-01-28)


### Features

* allow to lookup for grekt.yaml files on parent folders ([4fb9396](https://github.com/grekt-labs/cli/commit/4fb93968fdf90f5650400c0562955ab1205df1fc))

## [4.2.1](https://github.com/grekt-labs/cli/compare/v4.2.0...v4.2.1) (2026-01-28)


### Bug Fixes

* trigger update ([ccff1a7](https://github.com/grekt-labs/cli/commit/ccff1a7197a62553563c75f2d53ea2b9a256ac27))

# [4.2.0](https://github.com/grekt-labs/cli/compare/v4.1.0...v4.2.0) (2026-01-28)


### Features

* **pack:** add grekt pack command ([9f19501](https://github.com/grekt-labs/cli/commit/9f19501a532be1663f8ff2ce5fec3f8328597ec4))
* **publish:** make path argument optional ([b0f06e5](https://github.com/grekt-labs/cli/commit/b0f06e563487a4428e820112305e9f59b72cd707))

# [4.1.0](https://github.com/grekt-labs/cli/compare/v4.0.0...v4.1.0) (2026-01-28)


### Features

* **version:** add grekt version command ([a2f4fce](https://github.com/grekt-labs/cli/commit/a2f4fceec0de85c163a2248428ac5d2d4bde31ef))

# [4.0.0](https://github.com/grekt-labs/cli/compare/v3.0.1...v4.0.0) (2026-01-28)


* feat(versioning)!: implement semver-based version handling ([55a8b69](https://github.com/grekt-labs/cli/commit/55a8b692b4ee615f740ef213534b742f343dd3aa))


### BREAKING CHANGES

* Latest version is now highest semver, not most recently published

## [3.0.1](https://github.com/grekt-labs/cli/compare/v3.0.0...v3.0.1) (2026-01-28)


### Bug Fixes

* ensure only lazy artifacts in index ([ce23180](https://github.com/grekt-labs/cli/commit/ce2318096212b39fe924d8bc742f914a6a276754))

# [3.0.0](https://github.com/grekt-labs/cli/compare/v2.4.0...v3.0.0) (2026-01-28)


* feat(add)!: add --core flag and make LAZY mode default ([259ae0b](https://github.com/grekt-labs/cli/commit/259ae0b08e92e1123a6c153cd26df01819cd9f17))


### Features

* **install:** generate artifact index after install ([cfd0620](https://github.com/grekt-labs/cli/commit/cfd062014822b93a3905fa30e398dab54852072d))
* **publish:** add keywords and component validation ([fa5ee09](https://github.com/grekt-labs/cli/commit/fa5ee09a046447c1a6429c0a9de6f5b8ff566c69))
* **sync:** implement core/lazy mode filtering ([f52f69a](https://github.com/grekt-labs/cli/commit/f52f69a84b8effd29b4c7c6c5cbd7e3dcace8702))


### BREAKING CHANGES

* LAZY mode is now default. Artifacts are no longer
copied to target directories unless explicitly marked with --core flag.
Existing installations need to re-add artifacts with --core if they
require the files to be present in target directories.

- ca

# [2.4.0](https://github.com/grekt-labs/cli/compare/v2.3.5...v2.4.0) (2026-01-27)


### Bug Fixes

* update install URL and make CLI entry executable ([20dd4fc](https://github.com/grekt-labs/cli/commit/20dd4fc00909feb58b6c2437667b3aa4b3874cc8))


### Features

* add install script for Linux and macOS ([ed73c5b](https://github.com/grekt-labs/cli/commit/ed73c5bf7d6e8b8acfad3a15cc10fe442b9cdfce))

## [2.3.5](https://github.com/grekt-labs/cli/compare/v2.3.4...v2.3.5) (2026-01-27)


### Bug Fixes

* **add:** remove unnecessary large artifact warning ([ea40cf5](https://github.com/grekt-labs/cli/commit/ea40cf55738d3373d63003d09d8442834fd1e2cb))

## [2.3.4](https://github.com/grekt-labs/cli/compare/v2.3.3...v2.3.4) (2026-01-26)


### Bug Fixes

* **add:** create parent directory for scoped artifacts ([e17b17c](https://github.com/grekt-labs/cli/commit/e17b17c1039a01e21e307547f50b5c16e8f44d96))

## [2.3.3](https://github.com/grekt-labs/cli/compare/v2.3.2...v2.3.3) (2026-01-26)


### Bug Fixes

* **deps:** update cli-engine to 1.7.0 ([165c1e5](https://github.com/grekt-labs/cli/commit/165c1e5caeed59324ad85e35fccc4f984fee44ef))

## [2.3.2](https://github.com/grekt-labs/cli/compare/v2.3.1...v2.3.2) (2026-01-26)


### Bug Fixes

* remove legacy registry clients (now using cli-engine) ([311329b](https://github.com/grekt-labs/cli/commit/311329b3cf630351041768d2554f55ed0d931ce7))

## [2.3.1](https://github.com/grekt-labs/cli/compare/v2.3.0...v2.3.1) (2026-01-26)


### Bug Fixes

* **deps:** update cli-engine to 1.6.0 ([b5f3f27](https://github.com/grekt-labs/cli/commit/b5f3f2771a637209c7e2e16df92407e7cf635f85))

# [2.3.0](https://github.com/grekt-labs/cli/compare/v2.2.0...v2.3.0) (2026-01-25)


### Features

* fix macos build runner ([70d3471](https://github.com/grekt-labs/cli/commit/70d3471a2d376fb5bc224ad2cb6e0f996d9a0c33))

# [2.2.0](https://github.com/grekt-labs/cli/compare/v2.1.0...v2.2.0) (2026-01-25)


### Features

* unified release workflow ([c077f3a](https://github.com/grekt-labs/cli/commit/c077f3a2a557787a8334b77d69e8951a4c65b8fe))

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
