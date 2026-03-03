import type { ArtifactInfo } from "@grekt/engine";
import type { ComponentSelection } from "#/artifact/selector/selector";
import { selectComponentsWithPrecheck } from "#/artifact/selector/selector";
import { log, newline, colors } from "#/shared/ui/ui";
import type { StructureDiff } from "./upgrade.types";

/**
 * Display structural changes and prompt user to re-select components.
 * Used by both add and upgrade commands when a partial install encounters
 * structural changes in a new version.
 */
export async function promptStructuralChanges(
  artifactId: string,
  diff: StructureDiff,
  artifactInfo: ArtifactInfo,
  previousSelection: ComponentSelection
): Promise<ComponentSelection> {
  newline();
  log(`${colors.highlight(artifactId)}: structural changes detected`);

  if (diff.removedComponents.length > 0) {
    log(colors.dim("  Removed components:"));
    for (const { category, path } of diff.removedComponents) {
      log(`    ${colors.warning("-")} ${category}/${path}`);
    }
  }

  if (diff.addedComponents.length > 0) {
    log(colors.dim("  New components:"));
    for (const { category, path } of diff.addedComponents) {
      log(`    ${colors.success("+")} ${category}/${path}`);
    }
  }

  newline();

  return selectComponentsWithPrecheck(artifactInfo, previousSelection);
}
