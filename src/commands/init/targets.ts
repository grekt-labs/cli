import { confirmSelect } from "#/shared/prompts/prompts";
import {
  getPluginChoices,
  getDefaultTarget,
  detectInstalledTargets,
} from "#/sync/manager/manager";
import { selectTargets } from "#/shared/prompts/prompts";
import { info, newline, colors } from "#/shared/ui/ui";
import type { CustomTarget } from "@grekt/engine";
import type { InitOptions } from "./init.types";

export interface TargetSelectionResult {
  detectedTargets: string[];
  targets: string[];
  customTargets: Record<string, CustomTarget>;
}

/**
 * Auto-detect AI tools and resolve target selection.
 *
 * Handles all paths: --targets flag, --yes auto, --artifact optional, interactive.
 */
export async function resolveTargets(
  projectRoot: string,
  options: InitOptions,
): Promise<TargetSelectionResult> {
  const detectedTargets = detectInstalledTargets(projectRoot);
  const pluginChoices = getPluginChoices();
  const defaultTarget = getDefaultTarget();

  // Show detection results
  if (detectedTargets.length > 0) {
    const detectedNames = detectedTargets
      .map((id) => pluginChoices.find((c) => c.value === id)?.name ?? id)
      .join(", ");
    info(`Detected: ${colors.highlight(detectedNames)}`);
    newline();
  } else {
    info("No AI tools detected in this directory");
    newline();
  }

  // --targets flag: skip prompt entirely
  if (options.targets) {
    return {
      detectedTargets,
      targets: options.targets.split(",").map((t) => t.trim()).filter(Boolean),
      customTargets: {},
    };
  }

  // --artifact mode: targets are optional
  if (options.artifact) {
    let targets: string[] = [];
    let customTargets: Record<string, CustomTarget> = {};

    const shouldConfigure = !options.yes && await confirmSelect(
      "Configure sync targets? (optional for artifacts)",
      false,
    );

    if (shouldConfigure) {
      const result = await selectTargets(pluginChoices, {
        detectedTargets: detectedTargets.length > 0 ? detectedTargets : undefined,
        defaultCheckedIndex: detectedTargets.length === 0 ? 0 : undefined,
      });
      targets = result.targets;
      customTargets = result.customTargets;
    }

    return { detectedTargets, targets, customTargets };
  }

  // --yes auto mode: use detected or fall back to default
  if (options.yes) {
    return {
      detectedTargets,
      targets: detectedTargets.length > 0 ? detectedTargets : [defaultTarget],
      customTargets: {},
    };
  }

  // Interactive selection with detected targets pre-checked
  const result = await selectTargets(pluginChoices, {
    detectedTargets: detectedTargets.length > 0 ? detectedTargets : undefined,
    defaultCheckedIndex: detectedTargets.length === 0 ? 0 : undefined,
  });

  let targets = result.targets;
  const customTargets = result.customTargets;

  if (targets.length === 0) {
    targets = [defaultTarget];
    info(`No targets selected, defaulting to ${pluginChoices[0]?.name ?? defaultTarget}`);
  }

  return { detectedTargets, targets, customTargets };
}
