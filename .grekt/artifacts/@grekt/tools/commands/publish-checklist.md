---
type: command
name: publish-checklist
description: Quick checklist before publishing an artifact.
---

# /publish-checklist

Pre-publish verification checklist.

## Output

When user invokes `/publish-checklist`, respond with:

---

## Publish Checklist

### 1. Manifest
- [ ] `grekt.yaml` exists
- [ ] `name` is set (lowercase, hyphens)
- [ ] `author` is set (no @)
- [ ] `version` is bumped (semver)
- [ ] `description` is clear

### 2. Components
- [ ] All files have correct frontmatter (`type`, `name`, `description`)
- [ ] No empty files
- [ ] Content is complete and tested

### 3. Registry (if not public)
- [ ] `.grekt/config.yaml` has registry entry for your scope
- [ ] Token is set (config or env var)
- [ ] Token has write permissions

### 4. Version
- [ ] Version doesn't already exist in registry
- [ ] Changelog/notes updated (if applicable)

### 5. Test
- [ ] `grekt check` passes (if installed locally)
- [ ] Tested in target tool (Claude, Cursor, etc.)

---

**Ready?** Run:
```bash
grekt publish ./your-artifact
```
