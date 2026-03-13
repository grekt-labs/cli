import { fs } from "#/context";
import { saveConfig, saveLocalConfig } from "#/config/project/project";
import { createEmptyIndex } from "#/artifact/index/index";
import { ARTIFACTS_DIR } from "#/config/paths/paths";
import { ensureGitignore } from "#/shared/gitignore/gitignore";
import { getPlugin } from "#/sync/manager/manager";
import type { InitState } from "./init.types";

/**
 * Create all project files and run plugin setup.
 *
 * - .grekt/artifacts/ directory
 * - grekt.yaml
 * - .grekt/index
 * - .gitignore entry
 * - .grekt/config.yaml (if registries or dashboard configured)
 * - plugin.setup() for each target
 */
export function createProjectFiles(state: InitState): { hasLocalConfig: boolean } {
  const { projectRoot, manifestFields, targets, remoteSearch, customTargets, localConfig } = state;

  // Create .grekt/artifacts/ directory
  const artifactsPath = `${projectRoot}/${ARTIFACTS_DIR}`;
  if (!fs.exists(artifactsPath)) {
    fs.mkdir(artifactsPath, { recursive: true });
  }

  // Create grekt.yaml
  saveConfig({
    ...manifestFields,
    targets,
    remoteSearch,
    artifacts: {},
    customTargets,
  }, projectRoot);

  // Create empty index
  createEmptyIndex(projectRoot);

  ensureGitignore(projectRoot);

  // Save local config if registries or dashboard were configured
  const hasLocalConfig = !!(
    (localConfig.registries && Object.keys(localConfig.registries).length > 0)
    || localConfig.dashboard
  );

  if (hasLocalConfig) {
    saveLocalConfig(localConfig, projectRoot);
  }

  // Run plugin.setup() for each target
  for (const target of targets) {
    const plugin = getPlugin(target, customTargets);
    plugin.setup?.(projectRoot);
  }

  return { hasLocalConfig };
}
