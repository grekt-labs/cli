# Release Process

Internal documentation for the CLI release pipeline.

## Channels

| Channel | Branch | Version format | Homebrew | Install |
|---------|--------|---------------|----------|---------|
| stable | `main` | `6.27.0` | Yes | `curl -fsSL ... \| sh` |
| beta | `beta` | `6.27.0-beta.1` | No | `GREKT_CHANNEL=beta curl -fsSL ... \| sh` |

## Pipeline

Push to `main` or `beta` triggers the release workflow:

1. **validate** - Run tests and verify the build compiles
2. **semantic-release** - Analyze commits, bump version, create git tag
3. **build** - Compile binaries for linux-x64, macos-arm64, macos-x64
4. **publish** - Upload binaries to `grekt-labs/cli-releases` as a GitHub release
5. **update-homebrew** - Dispatch event to `grekt-labs/homebrew-grekt` (stable only)

## Publishing a Beta

```bash
# From a feature branch
git checkout beta
git merge feat/my-feature
git push origin beta
```

semantic-release on `beta` generates versions like `6.27.0-beta.1`, `6.27.0-beta.2`, etc. Each push with qualifying commits increments the pre-release number.

## Promoting Beta to Stable

```bash
git checkout main
git merge beta
git push origin main
```

semantic-release on `main` strips the pre-release suffix and publishes `6.27.0` as a stable release. Homebrew formula is updated automatically.

## Installing

### Stable (default)

```bash
curl -fsSL https://github.com/grekt-labs/cli-releases/releases/latest/download/install.sh | sh
```

### Beta

```bash
GREKT_CHANNEL=beta curl -fsSL https://github.com/grekt-labs/cli-releases/releases/latest/download/install.sh | sh
```

### Specific version

```bash
GREKT_VERSION=6.27.0-beta.1 curl -fsSL https://github.com/grekt-labs/cli-releases/releases/latest/download/install.sh | sh
```

## Commit Conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). semantic-release uses the commit type to determine the version bump:

| Commit prefix | Version bump | Example |
|--------------|-------------|---------|
| `fix:` | Patch (`6.27.1`) | `fix: resolve config parse error` |
| `feat:` | Minor (`6.28.0`) | `feat: add scan command` |
| `feat!:` or `BREAKING CHANGE:` | Major (`7.0.0`) | `feat!: redesign config format` |
| `chore:`, `docs:`, `ci:` | No release | `chore: update deps` |

## Secrets

The release workflow requires these repository secrets:

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Automatic, used by semantic-release for tags and commits |
| `GREKT_PACKAGES_NPMRC` | Auth token for `@grekt-labs` GitHub Packages (private npm deps) |
| `RELEASES_REPO_TOKEN` | PAT with repo access to `grekt-labs/cli-releases` for creating releases |
| `HOMEBREW_TAP_TOKEN` | PAT with repo access to `grekt-labs/homebrew-grekt` for formula updates |

## Branch Setup

The `beta` branch must exist as a permanent branch. Create it once:

```bash
git checkout main
git checkout -b beta
git push -u origin beta
```

After creation, protect the branch with the same rules as `main` (require PR, no force push).
