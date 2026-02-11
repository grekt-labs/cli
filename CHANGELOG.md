# [6.15.0](https://github.com/grekt-labs/cli/compare/v6.14.2...v6.15.0) (2026-02-11)


### Bug Fixes

* improve publish error feedback for auth and registry errors ([efea4ee](https://github.com/grekt-labs/cli/commit/efea4ee69c2128f39c62d9def56e720708531d6c))


### Features

* prompt sync after add-target and extract reusable sync runner ([d1f1b35](https://github.com/grekt-labs/cli/commit/d1f1b35312f71cf002d690c9af615f78ea9da890))

## [6.14.2](https://github.com/grekt-labs/cli/compare/v6.14.1...v6.14.2) (2026-02-11)


### Bug Fixes

* resolve target paths via plugin for correct cleanup ([9a690c9](https://github.com/grekt-labs/cli/commit/9a690c94b147a4043d6591e9d74ba0835e7c3477))
* update cli-engine to 5.14.0 for resolveTargetPath support ([a41bbc6](https://github.com/grekt-labs/cli/commit/a41bbc6156a2accd34d39f294bcb48e1d30de199))

## [6.14.1](https://github.com/grekt-labs/cli/compare/v6.14.0...v6.14.1) (2026-02-10)


### Bug Fixes

* update cli-engine 5.12.1 and migrate remaining call sites ([#125](https://github.com/grekt-labs/cli/issues/125)) ([c0f7dba](https://github.com/grekt-labs/cli/commit/c0f7dba6cb2cea5fb5b9f0eb54948d563634d51d))

# [6.14.0](https://github.com/grekt-labs/cli/compare/v6.13.1...v6.14.0) (2026-02-10)


### Features

* pass license and repository through publish flow ([410e81e](https://github.com/grekt-labs/cli/commit/410e81eabfddc9c828c14814bc97f31d0aeddbb8))

## [6.13.1](https://github.com/grekt-labs/cli/compare/v6.13.0...v6.13.1) (2026-02-09)


### Bug Fixes

* update cli-engine 5.11.1 to fix skill-router bundle error ([2155061](https://github.com/grekt-labs/cli/commit/2155061570b32634d517de4cf24f6f91f01f769f))

# [6.13.0](https://github.com/grekt-labs/cli/compare/v6.12.0...v6.13.0) (2026-02-09)


### Features

* **sync:** add setup() support and Claude skill router ([f68c650](https://github.com/grekt-labs/cli/commit/f68c65022819a22c7b0053e2f5c884f72aec1841))

# [6.12.0](https://github.com/grekt-labs/cli/compare/v6.11.0...v6.12.0) (2026-02-09)


### Features

* **config:** add artifact nesting path prompt to registry setup ([bae953c](https://github.com/grekt-labs/cli/commit/bae953c32ea6274b54d54ec9ce33773f30e69108))

# [6.11.0](https://github.com/grekt-labs/cli/compare/v6.10.0...v6.11.0) (2026-02-09)


### Features

* refactor plugin architecture, fix duplicate entry point, add 7 new plugins ([6284eb1](https://github.com/grekt-labs/cli/commit/6284eb11fc1fc24908fbdf668d63bbb8f0c76989))

# [6.10.0](https://github.com/grekt-labs/cli/compare/v6.9.0...v6.10.0) (2026-02-09)


### Bug Fixes

* upgrade cli-engine to 5.8.0 and fix publish tests for hooks category ([62aa742](https://github.com/grekt-labs/cli/commit/62aa742b5883854eb2f9f501091ae92da0f3d059))


### Features

* add hook install/uninstall utilities ([674e5ca](https://github.com/grekt-labs/cli/commit/674e5ca9be46dbdf91516721c505c32e008afedd))
* integrate hook install/uninstall into add and remove commands ([f4ae623](https://github.com/grekt-labs/cli/commit/f4ae623145025c911e07a95e94235fe11e8e4340))

# [6.9.0](https://github.com/grekt-labs/cli/compare/v6.8.0...v6.9.0) (2026-02-08)


### Features

* **publish:** send categories in publish request body ([e0a5ab9](https://github.com/grekt-labs/cli/commit/e0a5ab90b7078ea4ac24733e17b8131473d4b6eb))

# [6.8.0](https://github.com/grekt-labs/cli/compare/v6.7.1...v6.8.0) (2026-02-08)


### Features

* **init:** add .grekt to .gitignore during initialization ([c8bcdca](https://github.com/grekt-labs/cli/commit/c8bcdcacb4c742e9c92b3307e9c223d4f73b8f17))

## [6.7.1](https://github.com/grekt-labs/cli/compare/v6.7.0...v6.7.1) (2026-02-08)


### Bug Fixes

* **deps:** update cli-engine to 5.7.1 and add GREKT_REGISTRY_URL support ([80188f3](https://github.com/grekt-labs/cli/commit/80188f3d923ae809f595099946fceb6b8ac6bc2b))

# [6.7.0](https://github.com/grekt-labs/cli/compare/v6.6.2...v6.7.0) (2026-02-08)


### Features

* **deps:** update @grekt-labs/cli-engine to 5.6.0 ([fef4d74](https://github.com/grekt-labs/cli/commit/fef4d744c8e1ad0c9ba66082a055878c9642e7d3))

## [6.6.2](https://github.com/grekt-labs/cli/compare/v6.6.1...v6.6.2) (2026-02-07)


### Bug Fixes

* **deps:** update @grekt-labs/cli-engine to 5.5.6 ([a6dabf5](https://github.com/grekt-labs/cli/commit/a6dabf5a72dc97c9770d5ea75b3fa3d06a14f103))
* **publish:** pass private flag from manifest to publish context ([f2132a1](https://github.com/grekt-labs/cli/commit/f2132a14a64e8abd7cd6c65720cce8aeb55ae846))

## [6.6.1](https://github.com/grekt-labs/cli/compare/v6.6.0...v6.6.1) (2026-02-07)


### Bug Fixes

* **publish:** reorder checks before tarball creation ([66fea4f](https://github.com/grekt-labs/cli/commit/66fea4f70f5ea19b814ebf8840a707a98c6cb0c8))
* **publish:** split prepareArtifact into validate and tarball steps ([162f7ff](https://github.com/grekt-labs/cli/commit/162f7ffde68cd70343cedd1657a6c557733ecb10))

# [6.6.0](https://github.com/grekt-labs/cli/compare/v6.5.0...v6.6.0) (2026-02-07)


### Features

* structured error handling for registry API responses ([2e235f2](https://github.com/grekt-labs/cli/commit/2e235f2539e61442b4fcba89c443166adbcc2984))

# [6.5.0](https://github.com/grekt-labs/cli/compare/v6.4.3...v6.5.0) (2026-02-07)


### Features

* add interactive login method selection ([e0f584f](https://github.com/grekt-labs/cli/commit/e0f584f3fafe36ff6bdf5060512484da6fe47e3a))

## [6.4.3](https://github.com/grekt-labs/cli/compare/v6.4.2...v6.4.3) (2026-02-07)


### Bug Fixes

* replace leftover console.error with logger.debug in api-publisher ([8e8fc59](https://github.com/grekt-labs/cli/commit/8e8fc591a6f10463a10ca4ca2f40ee834c28016d))

## [6.4.2](https://github.com/grekt-labs/cli/compare/v6.4.1...v6.4.2) (2026-02-07)


### Bug Fixes

* correct license reference in README to BSL 1.1 ([eb8fd9f](https://github.com/grekt-labs/cli/commit/eb8fd9fb4c9c2def88d0f5768580512ec77c54a7))

## [6.4.1](https://github.com/grekt-labs/cli/compare/v6.4.0...v6.4.1) (2026-02-07)


### Bug Fixes

* case-insensitive matching for context entry points ([#109](https://github.com/grekt-labs/cli/issues/109)) ([b038e10](https://github.com/grekt-labs/cli/commit/b038e1076fabe9a637a97b9b1903c1248fa6e7df))

# [6.4.0](https://github.com/grekt-labs/cli/compare/v6.3.0...v6.4.0) (2026-02-06)


### Features

* add publish-confirm call after upload ([cc00477](https://github.com/grekt-labs/cli/commit/cc004775b5cf2d75bd6cef4c0319c92974531462))

# [6.3.0](https://github.com/grekt-labs/cli/compare/v6.2.1...v6.3.0) (2026-02-06)


### Features

* add artifact size limit validation ([ed8cbb8](https://github.com/grekt-labs/cli/commit/ed8cbb88589111b189fc9e72defb4101fbf38ff1))
* **http:** add default 15s timeout to all HTTP requests ([376c84c](https://github.com/grekt-labs/cli/commit/376c84c0b2e426816ae1cd542bc41fec872d71d0))

## [6.2.1](https://github.com/grekt-labs/cli/compare/v6.2.0...v6.2.1) (2026-02-06)


### Bug Fixes

* **publish:** show login prompt instead of GitLab config when not authenticated ([#105](https://github.com/grekt-labs/cli/issues/105)) ([c32440e](https://github.com/grekt-labs/cli/commit/c32440edb20288978d33713422051b92adaa5073))

# [6.2.0](https://github.com/grekt-labs/cli/compare/v6.1.2...v6.2.0) (2026-02-06)


### Features

* add upgrade command + preserve --choose selections ([#104](https://github.com/grekt-labs/cli/issues/104)) ([7ff9447](https://github.com/grekt-labs/cli/commit/7ff944721d03ad8d91ac31ccdff7fa7b10412983))

## [6.1.2](https://github.com/grekt-labs/cli/compare/v6.1.1...v6.1.2) (2026-02-06)


### Bug Fixes

* **add:** ensure temp directory cleanup on unexpected errors ([e4b6bad](https://github.com/grekt-labs/cli/commit/e4b6bad4fc82ded9ca0216ae7590032a8132c4ae))

## [6.1.1](https://github.com/grekt-labs/cli/compare/v6.1.0...v6.1.1) (2026-02-06)


### Bug Fixes

* **security:** harden session storage and download operations ([738499f](https://github.com/grekt-labs/cli/commit/738499fa067cbf41fe1487050bb5cdcc360f147a))

# [6.1.0](https://github.com/grekt-labs/cli/compare/v6.0.0...v6.1.0) (2026-02-06)


### Features

* **selector:** group components by directory and show descriptions ([4cfd065](https://github.com/grekt-labs/cli/commit/4cfd065e433250f852d7a60008c1eb66c7463660))

# [6.0.0](https://github.com/grekt-labs/cli/compare/v5.19.9...v6.0.0) (2026-02-05)


* feat(auth)!: move session storage to global ~/.grekt/session.yaml ([cc2981f](https://github.com/grekt-labs/cli/commit/cc2981f2eb638e5ff562720f8fa6777dffb1423c))


### Bug Fixes

* **config:** only inherit config from workspace roots ([7d7c48f](https://github.com/grekt-labs/cli/commit/7d7c48f42fbb5ad345ea0380b70490ec99348a9f))


### Features

* integrate with public registry via Edge Functions ([1598f5f](https://github.com/grekt-labs/cli/commit/1598f5f574aa81f7ca349347b44006b8e553f7a1))


### BREAKING CHANGES

* Session storage moved from project .grekt/config.yaml
to global ~/.grekt/session.yaml. Users need to run `grekt login` again.

- Add new config/user module for global session management
- Update auth/session to use global storage instead of project config
- Simplify config inheritance (remove workspace check for walk-up)
- Remove session functions from project config (registries/tokens only)
- Update tests for new session location

This separates auth (user-level) from registries (project-level):
- Session: ~/.grekt/session.yaml (accessible from anywhere)
- Registries: .grekt/config.yaml (project-specific)

## [5.19.9](https://github.com/grekt-labs/cli/compare/v5.19.8...v5.19.9) (2026-02-05)


### Bug Fixes

* rename folder to prefix in registry config ([12e2c92](https://github.com/grekt-labs/cli/commit/12e2c92a07da289525d519fed6657fbe3154e2e0))

## [5.19.8](https://github.com/grekt-labs/cli/compare/v5.19.7...v5.19.8) (2026-02-05)


### Bug Fixes

* **monorepos:** update cli-engine 5.5.1 ([e10eef3](https://github.com/grekt-labs/cli/commit/e10eef335d6e84b9a0bc78fddf08922e6cf79c1e))

## [5.19.7](https://github.com/grekt-labs/cli/compare/v5.19.6...v5.19.7) (2026-02-05)


### Bug Fixes

* **registry:** add folder field to resolver and types ([1b49335](https://github.com/grekt-labs/cli/commit/1b49335521bcc35c4165a00f82eb8ccf58527cbd))

## [5.19.6](https://github.com/grekt-labs/cli/compare/v5.19.5...v5.19.6) (2026-02-05)


### Bug Fixes

* trigger release ([a03b443](https://github.com/grekt-labs/cli/commit/a03b4438c32950aa17c3ebaf04328d42f6fc5bb8))

## [5.19.5](https://github.com/grekt-labs/cli/compare/v5.19.4...v5.19.5) (2026-02-05)


### Bug Fixes

* **deps:** bump cli-engine to 5.3.4 ([4c83e83](https://github.com/grekt-labs/cli/commit/4c83e83aea778b37c1669e470c3c1031f98c0670))

## [5.19.4](https://github.com/grekt-labs/cli/compare/v5.19.3...v5.19.4) (2026-02-05)


### Bug Fixes

* **deps:** bump cli-engine to 5.3.3 ([c2118e3](https://github.com/grekt-labs/cli/commit/c2118e3cf03e43e1a5d2e09366e67ab01fee5783))

## [5.19.3](https://github.com/grekt-labs/cli/compare/v5.19.2...v5.19.3) (2026-02-05)


### Bug Fixes

* resolve type errors and add typecheck to build pipeline ([#94](https://github.com/grekt-labs/cli/issues/94)) ([3a45bf9](https://github.com/grekt-labs/cli/commit/3a45bf928065b0f732d49029e19bf4f7e6fdb5db))

## [5.19.2](https://github.com/grekt-labs/cli/compare/v5.19.1...v5.19.2) (2026-02-05)


### Bug Fixes

* **deps:** update cli-engine to 5.3.1 ([c84c21c](https://github.com/grekt-labs/cli/commit/c84c21c3a2aa7c5b55ac8f676a8e3fbce4dbfa16))

## [5.19.1](https://github.com/grekt-labs/cli/compare/v5.19.0...v5.19.1) (2026-02-05)


### Bug Fixes

* add global error handler for cleaner error output ([#92](https://github.com/grekt-labs/cli/issues/92)) ([c729bfa](https://github.com/grekt-labs/cli/commit/c729bfa659c7b47a2885c83227a57f2f676f59cd))

# [5.19.0](https://github.com/grekt-labs/cli/compare/v5.18.2...v5.19.0) (2026-02-05)


### Features

* use friendly-errors for human-readable parsing errors ([#91](https://github.com/grekt-labs/cli/issues/91)) ([4b5b1b5](https://github.com/grekt-labs/cli/commit/4b5b1b5a7cc4001fa5c3add86d03a1de81dba770))

## [5.18.2](https://github.com/grekt-labs/cli/compare/v5.18.1...v5.18.2) (2026-02-05)


### Bug Fixes

* validate manifest fields before version bump ([60f8169](https://github.com/grekt-labs/cli/commit/60f816900cfa29b528f96f0964017fffb25ce9dc))

## [5.18.1](https://github.com/grekt-labs/cli/compare/v5.18.0...v5.18.1) (2026-02-04)


### Bug Fixes

* change rules format from json to md ([d850535](https://github.com/grekt-labs/cli/commit/d85053589d1e0d15725311217631c0f3ed07a1e5))

# [5.18.0](https://github.com/grekt-labs/cli/compare/v5.17.1...v5.18.0) (2026-02-04)


### Features

* **workspace:** add monorepo workspace support ([#87](https://github.com/grekt-labs/cli/issues/87)) ([31b90b8](https://github.com/grekt-labs/cli/commit/31b90b826e47f172aedddba43e6fd15e13037301))

## [5.17.1](https://github.com/grekt-labs/cli/compare/v5.17.0...v5.17.1) (2026-02-04)


### Bug Fixes

* **cleaner:** prevent deletion of dangerous paths like project root ([#86](https://github.com/grekt-labs/cli/issues/86)) ([e63719d](https://github.com/grekt-labs/cli/commit/e63719d8fb2e9dd04afbfb0a1ac169ca363959ca))

# [5.17.0](https://github.com/grekt-labs/cli/compare/v5.16.0...v5.17.0) (2026-02-04)


### Features

* add remove-target command and make add-target additive ([05dd2ee](https://github.com/grekt-labs/cli/commit/05dd2eeb3a56ad743540b2fca1fe4bf29a2b64b4))
* **version:** add prerelease --beta support ([#85](https://github.com/grekt-labs/cli/issues/85)) ([cb56944](https://github.com/grekt-labs/cli/commit/cb56944f69453c122524da5b548fb22409aca3ab))

# [5.16.0](https://github.com/grekt-labs/cli/compare/v5.15.2...v5.16.0) (2026-02-04)


### Features

* add post-command update-check against GitHub Releases ([44c14af](https://github.com/grekt-labs/cli/commit/44c14af6cb68e0a042b44a12a18f7e5e577c7f38))
* **update-check:** add brew upgrade option and improve notice styling ([83e7950](https://github.com/grekt-labs/cli/commit/83e7950f8aa899b7a0fbcef75fe1a960e9b3cf1c))

## [5.15.2](https://github.com/grekt-labs/cli/compare/v5.15.1...v5.15.2) (2026-02-03)


### Bug Fixes

* **remove:** properly remove synced files from all targets ([#82](https://github.com/grekt-labs/cli/issues/82)) ([dbffd03](https://github.com/grekt-labs/cli/commit/dbffd03c3ab3ba1118bb09524a86a503bdc5fdff))

## [5.15.1](https://github.com/grekt-labs/cli/compare/v5.15.0...v5.15.1) (2026-02-03)


### Bug Fixes

* update imports for cli-engine v5.0.0 API changes ([7d832e1](https://github.com/grekt-labs/cli/commit/7d832e16343cda4159aa72bad9bda828c81b27f8))

# [5.15.0](https://github.com/grekt-labs/cli/compare/v5.14.0...v5.15.0) (2026-02-03)


### Features

* auto-sync after add command ([2403c55](https://github.com/grekt-labs/cli/commit/2403c5589b536fffbd32644c0ebb987f1abdef55))
* improve registry config prompts with host selection ([1943381](https://github.com/grekt-labs/cli/commit/19433819a9b61940e09d498765deef44e37f4619))
* **publish:** improve error messages for scope and registry config ([b6e57e0](https://github.com/grekt-labs/cli/commit/b6e57e0112c6ae5a94ab5559c86a5c44217c237e))

# [5.14.0](https://github.com/grekt-labs/cli/compare/v5.13.0...v5.14.0) (2026-02-03)


### Features

* publish install script to releases repo ([4d4f91e](https://github.com/grekt-labs/cli/commit/4d4f91ec1f3dbb5cd9abae1ae3589d861b1a7cc0))

# [5.13.0](https://github.com/grekt-labs/cli/compare/v5.12.0...v5.13.0) (2026-02-02)


### Features

* update GitHub registry provider for GHCR ([#75](https://github.com/grekt-labs/cli/issues/75)) ([cfb1a59](https://github.com/grekt-labs/cli/commit/cfb1a59a42f2e2783c5ca7444b11d790430ddd89))

# [5.12.0](https://github.com/grekt-labs/cli/compare/v5.11.0...v5.12.0) (2026-02-01)


### Features

* add GitHub Container Registry (GHCR) support ([#74](https://github.com/grekt-labs/cli/issues/74)) ([ed6cc94](https://github.com/grekt-labs/cli/commit/ed6cc946e9292bdcabf7896830e05e5745a01c70))

# [5.11.0](https://github.com/grekt-labs/cli/compare/v5.10.2...v5.11.0) (2026-02-01)


### Features

* update cli-engine to 4.7.0 ([8e3b6c0](https://github.com/grekt-labs/cli/commit/8e3b6c02e067e5e61f693f6517ad33db8a3b311d))

## [5.10.2](https://github.com/grekt-labs/cli/compare/v5.10.1...v5.10.2) (2026-02-01)


### Bug Fixes

* **tarball:** use system tmpdir to avoid self-copy error ([#72](https://github.com/grekt-labs/cli/issues/72)) ([ef66d96](https://github.com/grekt-labs/cli/commit/ef66d961dcb198296e9a152d3970d52645d1b918))

## [5.10.1](https://github.com/grekt-labs/cli/compare/v5.10.0...v5.10.1) (2026-02-01)


### Bug Fixes

* **tarball:** exclude .grekt directory from artifact packaging ([#71](https://github.com/grekt-labs/cli/issues/71)) ([d58d1bb](https://github.com/grekt-labs/cli/commit/d58d1bb5ecdd90c83d2ea531209ab94d73d57f7e))

# [5.10.0](https://github.com/grekt-labs/cli/compare/v5.9.0...v5.10.0) (2026-02-01)


### Features

* auto-generate components in manifest during pack/publish ([607d45d](https://github.com/grekt-labs/cli/commit/607d45dd132e8275d75343becfc5f4fb3076effa))

# [5.9.0](https://github.com/grekt-labs/cli/compare/v5.8.1...v5.9.0) (2026-02-01)


### Features

* add dedicated add-target command for configuring sync targets ([#69](https://github.com/grekt-labs/cli/issues/69)) ([f302f98](https://github.com/grekt-labs/cli/commit/f302f9852fd7e105c9cd63f89ba8b38b70ae44d0))

## [5.8.1](https://github.com/grekt-labs/cli/compare/v5.8.0...v5.8.1) (2026-02-01)


### Bug Fixes

* auto-sync when using --core flag, remove autoSync config ([5bc871c](https://github.com/grekt-labs/cli/commit/5bc871ca8b5ef6f8c5408e6b649e753d28d3b834))
* custom targets always use FolderPlugin with default paths ([66545ca](https://github.com/grekt-labs/cli/commit/66545cabb206ab0242f083d5e229dc65b13298e2))

# [5.8.0](https://github.com/grekt-labs/cli/compare/v5.7.1...v5.8.0) (2026-02-01)


### Features

* update examples when initializing project with custom AI ([7e3c637](https://github.com/grekt-labs/cli/commit/7e3c637c2ff3de5aa63e6d3eb9007d7c6b58b1cc))

## [5.7.1](https://github.com/grekt-labs/cli/compare/v5.7.0...v5.7.1) (2026-02-01)


### Bug Fixes

* update cli-engine to 4.5.0 ([4fea780](https://github.com/grekt-labs/cli/commit/4fea78017426c0a4419cdde90dd29e587983817d))

# [5.7.0](https://github.com/grekt-labs/cli/compare/v5.6.3...v5.7.0) (2026-01-31)


### Bug Fixes

* trigger again release ([b755822](https://github.com/grekt-labs/cli/commit/b7558226d6802fb24dfe72716d26f6acd3e27a73))


### Features

* **sync:** add MANDATORY section to context entry points ([a7fd1a0](https://github.com/grekt-labs/cli/commit/a7fd1a047969aa063e83a3f5b433153733ae501b))

## [5.6.3](https://github.com/grekt-labs/cli/compare/v5.6.2...v5.6.3) (2026-01-31)


### Bug Fixes

* add missing new cli engine version ([47443ef](https://github.com/grekt-labs/cli/commit/47443ef3fcdf9edea6f7ac76c3c9ac6a2e3e21d9))

## [5.6.2](https://github.com/grekt-labs/cli/compare/v5.6.1...v5.6.2) (2026-01-31)


### Bug Fixes

* optional host for gitlab and github providers ([#63](https://github.com/grekt-labs/cli/issues/63)) ([ef5e315](https://github.com/grekt-labs/cli/commit/ef5e315cc9214368028debfcd4743327913baaa6))

## [5.6.1](https://github.com/grekt-labs/cli/compare/v5.6.0...v5.6.1) (2026-01-31)


### Bug Fixes

* remove lockfile generation from init command ([#62](https://github.com/grekt-labs/cli/issues/62)) ([0c1f96e](https://github.com/grekt-labs/cli/commit/0c1f96e234bbd90cc845e6c5cea6c3b517e80e38))

# [5.6.0](https://github.com/grekt-labs/cli/compare/v5.5.0...v5.6.0) (2026-01-31)


### Features

* add specific error messages for download failures ([#61](https://github.com/grekt-labs/cli/issues/61)) ([05b6307](https://github.com/grekt-labs/cli/commit/05b6307a1a00801584e9ee4e7adca312dd1f5344))

# [5.5.0](https://github.com/grekt-labs/cli/compare/v5.4.1...v5.5.0) (2026-01-31)


### Features

* improve CLI error messages for missing arguments ([#60](https://github.com/grekt-labs/cli/issues/60)) ([9c5967c](https://github.com/grekt-labs/cli/commit/9c5967ce59fede6cf18615c1b470e12073286061))

## [5.4.1](https://github.com/grekt-labs/cli/compare/v5.4.0...v5.4.1) (2026-01-31)


### Bug Fixes

* update cli engine missing version ([d6a8540](https://github.com/grekt-labs/cli/commit/d6a8540fdf637c18d215773f005b5a58b1cd8a9a))

# [5.4.0](https://github.com/grekt-labs/cli/compare/v5.3.0...v5.4.0) (2026-01-31)


### Features

* **config:** add interactive registry and repo-token commands ([9a36bcc](https://github.com/grekt-labs/cli/commit/9a36bcc5f9971e9545ec3831d328b21b310131ac))

# [5.3.0](https://github.com/grekt-labs/cli/compare/v5.2.0...v5.3.0) (2026-01-31)


### Features

* **claude:** sync skills as folders for Claude Code format ([#53](https://github.com/grekt-labs/cli/issues/53)) ([641c849](https://github.com/grekt-labs/cli/commit/641c8498f4545185fadeef8dba52842c312da662))

# [5.2.0](https://github.com/grekt-labs/cli/compare/v5.1.0...v5.2.0) (2026-01-31)


### Features

* **install:** show frontmatter validation errors on integrity failure ([1b1dc2d](https://github.com/grekt-labs/cli/commit/1b1dc2d297245ecd64f1e3126d8b304d2b616a17))

# [5.1.0](https://github.com/grekt-labs/cli/compare/v5.0.0...v5.1.0) (2026-01-31)


### Features

* improve error messages and fix install auth ([ad98429](https://github.com/grekt-labs/cli/commit/ad98429f0e538cfe4e8a8ee5dac80cb226a9b829))

# [5.0.0](https://github.com/grekt-labs/cli/compare/v4.10.2...v5.0.0) (2026-01-31)


### Bug Fixes

* trigger release for security improvements ([a16e42d](https://github.com/grekt-labs/cli/commit/a16e42d09443ae3f883057be5b3d7c059d025399))


### BREAKING CHANGES

* cli-engine upgraded to 4.0.0 with security improvements

## [4.10.2](https://github.com/grekt-labs/cli/compare/v4.10.1...v4.10.2) (2026-01-31)


### Bug Fixes

* **security:** align with cli-engine security improvements ([eb4fb4b](https://github.com/grekt-labs/cli/commit/eb4fb4bedb9e3bbf9d5baf808d9a3c969e2e2709))

## [4.10.1](https://github.com/grekt-labs/cli/compare/v4.10.0...v4.10.1) (2026-01-30)


### Bug Fixes

* update description and include all categories in custom target prompts ([5e0dd4b](https://github.com/grekt-labs/cli/commit/5e0dd4b333323146c1796f2843b10b96a96c2127))

# [4.10.0](https://github.com/grekt-labs/cli/compare/v4.9.0...v4.10.0) (2026-01-30)


### Features

* release ([14c331a](https://github.com/grekt-labs/cli/commit/14c331af9c0ba61f9373dbfb23659eb2ffd6d8ae))

# [4.9.0](https://github.com/grekt-labs/cli/compare/v4.8.4...v4.9.0) (2026-01-30)


### Features

* trigger release ([59a0a4e](https://github.com/grekt-labs/cli/commit/59a0a4e5b1e4d2617dfac0ccb8661366b216d015))

## [4.8.4](https://github.com/grekt-labs/cli/compare/v4.8.3...v4.8.4) (2026-01-30)


### Bug Fixes

* normalize author scope to prevent double @ in artifactId ([caa3480](https://github.com/grekt-labs/cli/commit/caa348015b1e2d485cd98dc87d0b8d7472f4c004))

## [4.8.3](https://github.com/grekt-labs/cli/compare/v4.8.2...v4.8.3) (2026-01-30)


### Bug Fixes

* check synced files for core mode artifacts ([a6663d3](https://github.com/grekt-labs/cli/commit/a6663d3289557f6891a4d4ee946ac0a52aa56b75))

## [4.8.2](https://github.com/grekt-labs/cli/compare/v4.8.1...v4.8.2) (2026-01-29)


### Bug Fixes

* show artifacts dir prompt ([8837b95](https://github.com/grekt-labs/cli/commit/8837b9555f8e119ff69e68c32e3e06f4aac2b178))

## [4.8.1](https://github.com/grekt-labs/cli/compare/v4.8.0...v4.8.1) (2026-01-29)


### Bug Fixes

* trigger release ([5e00fe6](https://github.com/grekt-labs/cli/commit/5e00fe62ed92c15cbbc37b6558e0c5d596bac747))

# [4.8.0](https://github.com/grekt-labs/cli/compare/v4.7.0...v4.8.0) (2026-01-29)


### Features

* **publish:** show detailed errors for invalid artifact files ([9843845](https://github.com/grekt-labs/cli/commit/98438457a1cd4a17f85edbd5a22d700973ae9e9d))

# [4.7.0](https://github.com/grekt-labs/cli/compare/v4.6.1...v4.7.0) (2026-01-29)


### Features

* **prompts:** add graceful exit handler for Ctrl+C ([b0e016b](https://github.com/grekt-labs/cli/commit/b0e016bed0f01bd4c8a6641e885eb0faf8e90576))

## [4.6.1](https://github.com/grekt-labs/cli/compare/v4.6.0...v4.6.1) (2026-01-29)


### Bug Fixes

* **init:** auto-add @ prefix to author if missing ([03af2b6](https://github.com/grekt-labs/cli/commit/03af2b6a4667ad3ccdbbb430b15e9bd2fb1e25af))

# [4.6.0](https://github.com/grekt-labs/cli/compare/v4.5.0...v4.6.0) (2026-01-29)


### Features

* **init:** add --artifact flag for publishable artifacts ([cf60e41](https://github.com/grekt-labs/cli/commit/cf60e41ee971c0cffd93882a4e10ff37abd68cb6))

# [4.5.0](https://github.com/grekt-labs/cli/compare/v4.4.3...v4.5.0) (2026-01-29)


### Features

* **sync:** add shared index generation module ([a1ffd5b](https://github.com/grekt-labs/cli/commit/a1ffd5b0a2e89d864424a1d55e48c93e37734d48))
* **sync:** implement SYNC strategy with XML bootstrap format ([02ae7e4](https://github.com/grekt-labs/cli/commit/02ae7e42f0f46e7f287d1acbf65cb6f77225da7d))
* **sync:** improve artifact mode handling and add interactive target config ([4e41721](https://github.com/grekt-labs/cli/commit/4e417217b1efb4d990cbec1ce9715604f35ebd9b))

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
