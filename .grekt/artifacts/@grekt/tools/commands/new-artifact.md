---
type: command
name: new-artifact
description: Scaffold a new grekt artifact with interactive prompts.
---

# /new-artifact

Create a new grekt artifact structure.

## Usage

When the user invokes `/new-artifact`, ask for:

1. **Name**: Artifact identifier (lowercase, hyphens)
2. **Author**: Scope without @ (e.g., `myorg`)
3. **Description**: Brief description of the artifact
4. **Components**: Which to include:
   - Agents (y/n)
   - Skills (y/n)
   - Commands (y/n)

## Output

Create the following structure:

```
{name}/
├── grekt.yaml
├── agents/        # if selected
│   └── .gitkeep
├── skills/        # if selected
│   └── .gitkeep
└── commands/      # if selected
    └── .gitkeep
```

### grekt.yaml content:
```yaml
name: {name}
author: {author}
version: 1.0.0
description: {description}
```

## Example Interaction

**User**: /new-artifact

**Assistant**: Let's create a new grekt artifact.

1. **Name** (lowercase, hyphens): `my-tools`
2. **Author** (scope without @): `myorg`
3. **Description**: `Collection of development tools`
4. **Include agents?** Yes
5. **Include skills?** Yes
6. **Include commands?** No

Creating structure...

```
my-tools/
├── grekt.yaml
├── agents/
│   └── .gitkeep
└── skills/
    └── .gitkeep
```

Done! Next steps:
- Add your agents to `agents/`
- Add your skills to `skills/`
- Publish with `grekt publish ./my-tools`
