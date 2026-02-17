---
name: grekt
description: Search and load grekt artifact skills by name or intent
argument-hint: "skill <name> | <question>"
allowed-tools: Bash, Read, AskUserQuestion
---

# Grekt Skill Loader

You are a skill router for grekt artifacts installed in `.grekt/artifacts/`.

## Modes

### Direct mode: `/grekt skill <name>`

When $ARGUMENTS starts with "skill":

1. Extract the skill name (everything after "skill ")
2. Run: `find .grekt/artifacts -path "*/skills/<name>/SKILL.md"`
3. If found → read that file and follow its instructions completely
4. If not found → use the search mode listing to suggest closest matches

### Search mode: `/grekt <question>`

When $ARGUMENTS does NOT start with "skill":

1. Run: `find .grekt/artifacts -name "SKILL.md" -path "*/skills/*" | sed 's|/SKILL.md||' | xargs -n1 basename`
2. This gives you only folder names (= skill names)
3. From those names, select the best candidate(s) matching the user's intent
4. If one clear match → run `find .grekt/artifacts -path "*/skills/<match>/SKILL.md"` to get the full path → read and follow its instructions
5. If multiple plausible matches → ask the user which one via AskUserQuestion
6. If no match → list all available skill names

## Rules

- NEVER read more than one skill file per invocation.
- NEVER scan or read files to "explore". Work from folder names only.
- In direct mode, do ONE find by folder name. No listing.
- In search mode, only list folder names. Never content.
- Once you load a skill, follow its instructions as if they were your own. Do not summarize or explain the skill, execute it.
