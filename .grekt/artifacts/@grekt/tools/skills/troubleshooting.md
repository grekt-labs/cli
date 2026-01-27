---
type: skill
name: troubleshooting
description: Common grekt issues and their solutions.
---

# Grekt Troubleshooting

## Installation Issues

### "Not in a grekt project"
**Cause**: No `grekt.yaml` in current directory.
**Solution**: Run `grekt init` or navigate to project root.

### "Artifact not found"
**Cause**: Artifact doesn't exist in registry or typo in name.
**Solution**:
- Verify artifact name and scope
- Check registry configuration for private artifacts
- Ensure you have access permissions

## Publishing Issues

### "Version X already exists"
**Cause**: Cannot overwrite published versions.
**Solution**: Bump version in `grekt.yaml` and try again.

### "Authentication required"
**Cause**: Missing or invalid token.
**Solution**:
```yaml
# .grekt/config.yaml
registries:
  "@scope":
    type: gitlab
    token: glpat-xxx
```
Or set `GITLAB_TOKEN` environment variable.

### "Permission denied"
**Cause**: Token lacks required permissions.
**Solution**: Generate new token with `api` or `write_package_registry` scope.

### "Project not found"
**Cause**: Wrong project path in config.
**Solution**: Verify exact path (case-sensitive) in GitLab/GitHub.

## Sync Issues

### "Target not configured"
**Cause**: Sync target missing from project config.
**Solution**: Add target to `grekt.yaml`:
```yaml
sync:
  targets:
    - claude
    - cursor
```

### "Sync produces no output"
**Cause**: No artifacts installed or no components match target.
**Solution**:
- Run `grekt install` first
- Verify artifacts have agents/skills/commands

### Changes not appearing in tool
**Cause**: Tool caching old config.
**Solution**: Restart the tool (Claude Code, Cursor, etc.)

## Integrity Issues

### "Integrity mismatch"
**Cause**: Local files modified or corrupted download.
**Solution**:
```bash
grekt check           # Diagnose issues
grekt install --force # Reinstall artifacts
```

### "Missing files"
**Cause**: Files deleted or incomplete installation.
**Solution**: Run `grekt install --force` to reinstall.

## Command Reference

| Command | Purpose |
|---------|---------|
| `grekt init` | Initialize new project |
| `grekt add @scope/name` | Add artifact to project |
| `grekt install` | Install from lockfile |
| `grekt sync` | Sync to configured targets |
| `grekt check` | Verify integrity |
| `grekt publish ./path` | Publish artifact |

## Getting Help

- Check `grekt --help` for command options
- Visit https://grekt.com for documentation
- Report issues at https://github.com/grekt-labs/cli/issues
