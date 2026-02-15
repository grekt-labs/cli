import { Command } from "commander";
import { join, dirname, isAbsolute } from "path";
import { confirm } from "@inquirer/prompts";
import { fs, shell } from "#/context";
import { success, error, info } from "#/shared/ui/ui";
import { withPromptHandler } from "#/shared/prompts/prompts";

const GREKT_DIR = ".grekt";

function getGitCommonDir(): string | null {
  try {
    return shell.execFile("git", ["rev-parse", "--git-common-dir"]).trim();
  } catch {
    return null;
  }
}

function getWorktreeRoot(): string | null {
  try {
    return shell.execFile("git", ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    return null;
  }
}

function resolveOriginalRepoRoot(commonDir: string, worktreeRoot: string): string {
  // For worktrees, git returns an absolute path like /path/to/original/.git
  // For the main repo, it returns ".git" (relative).
  const absoluteCommonDir = isAbsolute(commonDir) ? commonDir : join(worktreeRoot, commonDir);
  return dirname(absoluteCommonDir);
}

function isInsideWorktree(commonDir: string): boolean {
  // If common dir is ".git", we're in the main repo, not a worktree.
  // Worktrees return an absolute path to the original repo's .git directory.
  return commonDir !== ".git";
}

const syncSubcommand = new Command("sync")
  .description("Copy .grekt/ from the original repo to the current worktree")
  .option("-f, --force", "Overwrite existing .grekt/ without confirmation")
  .action(async (options: { force?: boolean }) => {
    const commonDir = getGitCommonDir();

    if (!commonDir) {
      error("Not inside a git repository");
      process.exit(1);
    }

    if (!isInsideWorktree(commonDir)) {
      error("Not inside a git worktree");
      info("This command copies .grekt/ from the original repo to a worktree");
      process.exit(1);
    }

    const worktreeRoot = getWorktreeRoot();

    if (!worktreeRoot) {
      error("Could not determine worktree root");
      process.exit(1);
    }

    const originalRepoRoot = resolveOriginalRepoRoot(commonDir, worktreeRoot);
    const sourcePath = join(originalRepoRoot, GREKT_DIR);
    const destPath = join(worktreeRoot, GREKT_DIR);

    if (!fs.exists(sourcePath)) {
      info("No .grekt/ directory found in the original repository");
      process.exit(0);
    }

    if (fs.exists(destPath)) {
      if (!options.force) {
        const shouldOverwrite = await withPromptHandler(() =>
          confirm({
            message: ".grekt/ already exists in this worktree. Overwrite?",
            default: false,
          }),
        );

        if (!shouldOverwrite) {
          info("Skipped");
          process.exit(0);
        }
      }

      fs.rmdir(destPath, { recursive: true });
    }

    fs.copy(sourcePath, destPath, { recursive: true });
    success(".grekt/ synced to worktree");
  });

export const worktreeCommand = new Command("worktree")
  .description("Manage git worktree integration")
  .addCommand(syncSubcommand);
