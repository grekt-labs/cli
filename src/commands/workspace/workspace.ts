import { Command } from "commander";
import { loadWorkspace } from "#/workspace/workspace";
import { error, info, log, colors } from "#/shared/ui/ui";

// Re-export workspace utilities for backwards compatibility
export {
  loadWorkspace,
  generatePackageJsonFiles,
  syncVersionsToManifest,
  cleanPackageJsonFiles,
  type WorkspaceData,
} from "#/workspace/workspace";

// List subcommand
const listSubcommand = new Command("list")
  .description("List all artifacts in the workspace")
  .action(async () => {
    const cwd = process.cwd();
    const workspace = await loadWorkspace(cwd);

    if (!workspace) {
      error("No grekt-workspace.yaml found in current directory");
      process.exit(1);
    }

    if (workspace.artifacts.length === 0) {
      info("No artifacts found in workspace");
      return;
    }

    log("");
    info(`Found ${workspace.artifacts.length} artifact(s) in workspace:`);
    log("");

    for (const artifact of workspace.artifacts) {
      log(`  ${colors.bold(artifact.manifest.name)} ${colors.dim(`v${artifact.manifest.version}`)}`);
      log(`    ${colors.dim(artifact.relativePath)}`);
    }

    log("");
  });

// Main workspace command
export const workspaceCommand = new Command("workspace")
  .description("Manage monorepo workspaces")
  .addCommand(listSubcommand);
