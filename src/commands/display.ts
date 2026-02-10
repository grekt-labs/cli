import { log, colors } from "#/shared/ui/ui";
import type { ComponentSummaryParams } from "./display.types";

export function logComponentSummary(params: ComponentSummaryParams): void {
  const { artifactId, version, action, keywords, scanned, componentCount } = params;

  log(colors.bold(`\n${action} ${artifactId}@${version}...`));
  if (keywords && keywords.length > 0) {
    log(colors.dim(`  Keywords: ${keywords.join(", ")}`));
  }
  log(colors.dim(`  Components: ${componentCount}`));
  if (scanned.agent) log(colors.dim(`    - 1 agent`));
  if (scanned.skills.length > 0) log(colors.dim(`    - ${scanned.skills.length} skill(s)`));
  if (scanned.commands.length > 0) log(colors.dim(`    - ${scanned.commands.length} command(s)`));
  if (scanned.mcps.length > 0) log(colors.dim(`    - ${scanned.mcps.length} mcp(s)`));
  if (scanned.rules.length > 0) log(colors.dim(`    - ${scanned.rules.length} rule(s)`));
  log("");
}
