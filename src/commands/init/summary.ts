import { confirmSelect } from "#/shared/prompts/prompts";
import { GREKT_YAML, GREKT_DIR, INDEX_FILE } from "#/config/paths/paths";
import { success, info, warning, newline, log, colors } from "#/shared/ui/ui";
import type { InitState } from "./init.types";

interface SummaryOptions {
  hasLocalConfig: boolean;
  isArtifact: boolean;
  skipPrompts: boolean;
}

/**
 * Show summary of created files, warnings, and next steps.
 *
 * - Lists created files
 * - Warns about missing registry tokens
 * - Offers to install @grekt/tools (when remoteSearch is enabled)
 * - Shows quick reference
 */
export async function showSummary(state: InitState, options: SummaryOptions): Promise<void> {
  const { manifestFields, targets, remoteSearch, scopesMissingTokens } = state;
  const { hasLocalConfig, isArtifact, skipPrompts } = options;

  newline();
  success(`Created ${GREKT_YAML}`);
  success(`Created ${GREKT_DIR}/`);
  success(`Created ${INDEX_FILE}`);
  if (hasLocalConfig) {
    success(`Created ${GREKT_DIR}/config.yaml`);
  }
  newline();

  if (isArtifact) {
    success("Artifact initialized successfully!");
    newline();
    info(`Artifact: @${manifestFields.author}/${manifestFields.name}@${manifestFields.version}`);
    info("Run 'grekt publish' when ready to publish");
    return;
  }

  success("grekt initialized successfully!");
  newline();
  info(`Sync targets: ${targets.join(", ")}`);

  // Warn about missing tokens
  if (scopesMissingTokens.length > 0) {
    newline();
    warning(`Missing tokens for: ${scopesMissingTokens.join(", ")}`);
    info("You can add them later with 'grekt config token set @scope'");
  }

  // Offer to install @grekt/tools if remote search is enabled
  if (remoteSearch && !skipPrompts) {
    newline();
    const installTools = await confirmSelect(
      "Install @grekt/tools? (recommended)",
      true,
    );

    if (installTools) {
      const { addCommand } = await import("#/commands/add");
      await addCommand.parseAsync(["node", "add", "@grekt/tools"]);
    }
  }

  // Quick reference
  newline();
  log(colors.bold("Quick reference:"));
  log(`  ${colors.highlight("grekt add <artifact>")}    Add an artifact`);
  log(`  ${colors.highlight("grekt sync")}              Sync to your AI tools`);
  log(`  ${colors.highlight("grekt scan")}              Security scan`);
}
