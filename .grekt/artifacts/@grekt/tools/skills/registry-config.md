---
type: skill
name: registry-config
description: Knowledge about configuring grekt registries for publishing and installing artifacts.
---

# Registry Configuration

## Registry Types

Grekt supports multiple registry backends:

| Type | Use Case |
|------|----------|
| `default` | Public grekt registry (registry.grekt.com) |
| `gitlab` | GitLab Generic Package Registry |
| `github` | GitHub Packages (future) |

## Configuration File

Registry configuration lives in `.grekt/config.yaml`:

```yaml
registries:
  "@myscope":
    type: gitlab
    host: gitlab.com
    project: mygroup/artifacts-repo
    token: glpat-xxxxxxxxxxxx
```

## GitLab Registry Setup

### 1. Create a GitLab Repository
Create a repo to host your artifacts (e.g., `mygroup/artifacts`).

### 2. Generate Access Token
- Go to GitLab > Settings > Access Tokens
- Create token with `api` or `write_package_registry` scope

### 3. Configure grekt
```yaml
# .grekt/config.yaml
registries:
  "@myorg":
    type: gitlab
    host: gitlab.com           # or your self-hosted instance
    project: myorg/artifacts   # group/project path
    token: glpat-xxx           # or use GITLAB_TOKEN env var
```

### 4. Publish
```bash
grekt publish ./my-artifact
```

## Token Priority

1. Token in `.grekt/config.yaml`
2. Environment variable (`GITLAB_TOKEN`, `GITHUB_TOKEN`)
3. No token (public access only)

## Multiple Registries

You can configure different registries per scope:

```yaml
registries:
  "@public":
    type: default
  "@company":
    type: gitlab
    host: gitlab.company.com
    project: company/artifacts
  "@team":
    type: gitlab
    host: gitlab.com
    project: team/shared-artifacts
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GITLAB_TOKEN` | GitLab authentication |
| `GITHUB_TOKEN` | GitHub authentication |
| `GREKT_TOKEN` | Default registry authentication |

## Troubleshooting

### "Version already exists"
Cannot overwrite published versions. Bump version in `grekt.yaml`.

### "Authentication required"
Set token in config or environment variable.

### "Project not found"
Verify `project` path matches exactly (case-sensitive).

### "Permission denied"
Token needs `write_package_registry` scope for publishing.
