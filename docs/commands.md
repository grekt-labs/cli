# Commands

How CLI commands are structured and how to add new ones.

## Overview

Commands use [Commander.js](https://github.com/tj/commander.js). Each command lives in its own file under `src/commands/`.

```
src/commands/
├── init/            # Initialize grekt (modular folder)
│   ├── init.ts      # Orchestrator
│   ├── targets.ts   # Auto-detect + target selection
│   ├── registries.ts# Self-hosted registry wizard
│   ├── dashboard.ts # Dashboard setup step
│   ├── files.ts     # File creation
│   ├── summary.ts   # Post-init summary
│   ├── manifest.ts  # Artifact manifest prompts
│   └── init.types.ts
├── add.ts           # Add artifact from registry/GitHub/GitLab
├── upgrade.ts       # Upgrade artifacts to latest versions
├── sync.ts          # Sync artifacts to AI tools
├── check.ts         # Verify artifact integrity
├── login.ts         # Authenticate with registry
└── ...
```

## Command Anatomy

Let's look at a real command (`check.ts`) to understand the structure:

```typescript
// 1. Imports
import { Command } from "commander";
import { isInitialized } from "#/config/project/project";
import { getLockfile } from "#/context";
import { runCheck, displayCheckResults } from "#/artifact/check/check";
import { error, info, newline } from "#/shared/ui/ui";

// 2. Create and export the command
export const checkCommand = new Command("check")
  .description("Check artifact integrity, sync status, and detect conflicts")
  .action(async () => {
    // 3. Get project root (almost always process.cwd())
    const projectRoot = process.cwd();

    // 4. Check if grekt is initialized (most commands need this)
    if (!isInitialized(projectRoot)) {
      error("grekt is not initialized in this directory");
      info("Run 'grekt init' first");
      process.exit(1);
    }

    // 5. Read lockfile/config as needed
    const lockfile = getLockfile(projectRoot);
    const artifactIds = Object.keys(lockfile.artifacts);

    // 6. Handle edge cases
    if (artifactIds.length === 0) {
      info("No artifacts installed");
      process.exit(0);
    }

    // 7. Execute the actual logic
    const summary = runCheck(projectRoot);
    displayCheckResults(summary, lockfile);

    // 8. Show helpful hints based on results
    if (!summary.healthy) {
      newline();
      if (summary.driftCount > 0) {
        info("To restore modified artifacts: grekt install --force");
      }
      if (summary.missingCount > 0) {
        info("To reinstall missing artifacts: grekt install");
      }
    }
  });
```

## Step-by-Step: Creating a New Command

### Step 1: Create the file

Create a new file in `src/commands/`. Name it after the command:

```bash
# For "grekt my-command", create:
src/commands/my-command.ts
```

### Step 2: Write the basic structure

Start with imports and the command skeleton:

```typescript
import { Command } from "commander";
import { isInitialized, getConfig } from "#/config/project/project";
import { getLockfile, saveLockfile } from "#/context";
import { success, error, info, warning, newline, log, colors, spinner } from "#/shared/ui/ui";

export const myCommand = new Command("my-command")
  .description("Short description of what this command does")
  .action(async () => {
    const projectRoot = process.cwd();

    // Your logic here
  });
```

### Step 3: Add arguments and options (if needed)

```typescript
export const myCommand = new Command("my-command")
  .description("Short description")
  // Arguments: <required> or [optional]
  .argument("<source>", "The source to process (required)")
  .argument("[target]", "Optional target path")
  // Options: short flag, long flag, description
  .option("-f, --force", "Skip confirmation prompts")
  .option("-o, --output <path>", "Output path (option with value)")
  .option("-v, --verbose", "Show detailed output")
  .action(async (source, target, options) => {
    // source: string (required argument)
    // target: string | undefined (optional argument)
    // options: { force?: boolean, output?: string, verbose?: boolean }
  });
```

### Step 4: Add initialization check

Most commands require grekt to be initialized. Add this at the start:

```typescript
.action(async (options) => {
  const projectRoot = process.cwd();

  if (!isInitialized(projectRoot)) {
    error("grekt is not initialized in this directory");
    info("Run 'grekt init' first");
    process.exit(1);
  }

  // Continue with logic...
});
```

### Step 5: Register the command

Open `src/index.ts` and add your command:

```typescript
// Import at the top
import { myCommand } from "#/commands/my-command";

// Add to the appropriate group (see groupings in the file)
// Auth commands
program.addCommand(loginCommand);
// ...

// Project commands
program.addCommand(initCommand);
program.addCommand(myCommand);  // <-- Add here if project-related
// ...

// Registry commands
program.addCommand(publishCommand);
// ...
```

### Step 6: Test manually

```bash
# From the cli/ directory
bun run src/index.ts my-command --help
bun run src/index.ts my-command <args>
```

---

## Shared Utilities Reference

### UI Output (`#/shared/ui/ui`)

The UI module provides consistent terminal output. Always use these instead of `console.log`.

```typescript
import {
  success,    // Green checkmark + message
  error,      // Red X + message
  info,       // Blue info icon + message
  warning,    // Yellow warning icon + message
  log,        // Plain text (no icon)
  newline,    // Empty line for spacing
  colors,     // Color helper functions
  spinner,    // Loading spinner for async ops
} from "#/shared/ui/ui";
```

**When to use each:**

```typescript
// success: Operation completed successfully
success("Installed @author/artifact@1.0.0");

// error: Something failed, user needs to take action
error("Artifact not found");

// info: Helpful hints, suggestions, next steps
info("Run 'grekt sync' to sync with your AI tools");

// warning: Not an error, but user should be aware
warning("This version is deprecated");

// log: Neutral information, lists, details
log("Available targets: claude, cursor");

// newline: Visual separation
success("Step 1 done");
newline();
info("Starting step 2...");
```

**Colors for formatted output:**

```typescript
// Highlight important values (artifact names, versions, etc.)
log(`Installed ${colors.highlight("@author/artifact")}@${colors.highlight("1.0.0")}`);

// Dim for secondary/less important info
log(`Source: ${colors.dim("https://registry.grekt.com/...")}`);

// Brand color for grekt-specific text
log(colors.brand("grekt"));

// Bold for headers/emphasis
log(colors.bold("Syncing artifacts..."));
```

**Spinner for async operations:**

```typescript
const spin = spinner("Downloading artifact...");
spin.start();

try {
  await downloadSomething();
  spin.stop();
  success("Downloaded successfully");
} catch (e) {
  spin.stop();  // IMPORTANT: Always stop spinner before showing error
  error(`Download failed: ${e.message}`);
  process.exit(1);
}
```

### Context Module (`#/context`)

The context module provides two things:

1. **Singletons**: Direct access to I/O implementations
2. **Engine wrappers**: Functions that call cli-engine with the singleton injected

#### Singletons

These are real implementations of cli-engine interfaces. Use them for direct I/O:

```typescript
import { fs, http, shell, cryptoProvider } from "#/context";

// FileSystem operations
if (fs.exists(path)) {
  const content = fs.readFile(path);
  fs.writeFile(newPath, content);
}

fs.mkdir(dir, { recursive: true });
fs.rmdir(dir, { recursive: true });
fs.copyFile(src, dest);

// HTTP operations (rarely used directly, prefer engine functions)
const response = await http.fetch(url);

// Shell operations
const output = shell.execFile("git", ["status"]);

// Crypto (for generating UUIDs, etc.)
const id = cryptoProvider.randomUUID();
```

#### Engine Wrappers

These are convenience functions that call cli-engine functions with the `fs` singleton already injected. This saves you from writing `someEngineFunction(fs, ...)` everywhere.

```typescript
import {
  // Lockfile operations
  getLockfile,       // Read grekt.lock
  saveLockfile,      // Write grekt.lock
  lockfileExists,    // Check if grekt.lock exists
  createEmptyLockfile, // Create empty lockfile structure

  // Artifact operations
  scanArtifact,      // Parse artifact directory, categorize files

  // Integrity operations
  hashDirectory,     // Get hashes of all files in a directory
  verifyIntegrity,   // Check if files match expected hashes
  getDirectorySize,  // Get total size of a directory
} from "#/context";

// Example: Read lockfile
const lockfile = getLockfile(projectRoot);
// Internally does: _getLockfile(fs, `${projectRoot}/grekt.lock`)

// Example: Scan an artifact
const artifactInfo = scanArtifact(artifactDir);
// Internally does: _scanArtifact(fs, artifactDir)
// Returns: { manifest, agents: [...], skills: [...], commands: [...], ... }
```

**Why wrappers exist:**

Without wrappers, you'd have to import `fs` and pass it everywhere:

```typescript
// Without wrappers (verbose)
import { fs } from "#/context";
import { getLockfile as _getLockfile } from "@grekt/engine";

const lockfile = _getLockfile(fs, `${projectRoot}/grekt.lock`);
```

With wrappers:

```typescript
// With wrappers (clean)
import { getLockfile } from "#/context";

const lockfile = getLockfile(projectRoot);
```

### Config Operations (`#/config/project/project`)

```typescript
import {
  isInitialized,  // Check if grekt.yaml exists
  getConfig,      // Read grekt.yaml
  saveConfig,     // Write grekt.yaml
} from "#/config/project/project";

// Check initialization
if (!isInitialized(projectRoot)) {
  // Handle not initialized...
}

// Read config
const config = getConfig(projectRoot);
// config.targets: string[]
// config.artifacts: Record<string, VersionString | DetailedEntry>
// config.customTargets: Record<string, CustomTarget>

// Modify and save
config.targets.push("cursor");
saveConfig(config, projectRoot);
```

### Paths (`#/config/paths/paths`)

Constants for standard file/directory paths:

```typescript
import {
  GREKT_YAML,      // "grekt.yaml" - main config file
  GREKT_LOCK,      // "grekt.lock" - lockfile (renamed internally)
  LOCKFILE,        // "grekt.lock" - same as GREKT_LOCK
  GREKT_DIR,       // ".grekt" - hidden directory
  ARTIFACTS_DIR,   // ".grekt/artifacts" - installed artifacts
  INDEX_FILE,      // ".grekt/index" - artifact index for AI
} from "#/config/paths/paths";

// Usage
const artifactPath = `${projectRoot}/${ARTIFACTS_DIR}/@author/my-artifact`;
const configPath = `${projectRoot}/${GREKT_YAML}`;
```

### Prompts (`#/shared/prompts/prompts`)

For interactive user input:

```typescript
import { withPromptHandler, selectTargets, confirmSelect } from "#/shared/prompts/prompts";
import { input, select } from "@inquirer/prompts";

// ALWAYS wrap prompts with withPromptHandler to handle Ctrl+C gracefully
await withPromptHandler(async () => {
  // Use confirmSelect for Yes/No (arrow keys, no typing)
  const shouldContinue = await confirmSelect("Continue with installation?", true);

  const name = await input({
    message: "Artifact name:",
    validate: (value) => value.trim() ? true : "Name is required",
  });

  const target = await select({
    message: "Select target:",
    choices: [
      { name: "Claude", value: "claude" },
      { name: "Cursor", value: "cursor" },
    ],
  });
});
```

---

## Reference Commands

For real-world examples, look at these commands in `src/commands/`:

| Command | Pattern | Key Features |
|---------|---------|--------------|
| `check.ts` | Simple, no args | Basic flow, exit codes |
| `add.ts` | Args + options | Spinners, error handling, index regeneration |
| `upgrade.ts` | Batch operation | Iterating artifacts, selection preservation |
| `init/init.ts` | Modular wizard | Auto-detect, registries, dashboard, `confirmSelect` |
| `sync.ts` | Multi-target | Iterating over plugins |
| `trust.ts` | Paired commands | Two commands in one file, config mutation |
| `scan.ts` | CI integration | `--fail-on` threshold, `evaluateFailOn` helper |

---

## Common Mistakes to Avoid

1. **Forgetting to check initialization**
   ```typescript
   // BAD: Assumes grekt is initialized
   const config = getConfig(projectRoot);

   // GOOD: Check first
   if (!isInitialized(projectRoot)) {
     error("grekt is not initialized");
     process.exit(1);
   }
   const config = getConfig(projectRoot);
   ```

2. **Not stopping spinner before error**
   ```typescript
   // BAD: Spinner keeps running during error
   spin.start();
   if (failed) {
     error("Failed");
     process.exit(1);
   }

   // GOOD: Stop spinner first
   spin.start();
   if (failed) {
     spin.stop();
     error("Failed");
     process.exit(1);
   }
   ```

3. **Forgetting to regenerate index after artifact changes**
   ```typescript
   // After add/remove/install operations:
   generateArtifactIndex(projectRoot, config);
   ```

4. **Using console.log instead of UI utilities**
   ```typescript
   // BAD
   console.log("Done!");

   // GOOD
   success("Done!");
   ```

5. **Not wrapping prompts with withPromptHandler**
   ```typescript
   // BAD: Ctrl+C won't be handled gracefully
   const answer = await confirm({ message: "Continue?" });

   // GOOD
   await withPromptHandler(async () => {
     const answer = await confirm({ message: "Continue?" });
   });
   ```
