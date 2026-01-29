import { createFolderPlugin, GREKT_BLOCK_START, GREKT_BLOCK_END } from "#/sync/base/base";
import type { Lockfile } from "@grekt-labs/cli-engine";

const TARGET_DIR = ".claude";
const RULES_FILE = `${TARGET_DIR}/CLAUDE.md`;

/**
 * Generate minimal bootstrap content for CLAUDE.md.
 * Points Claude to the artifact index for lazy loading.
 */
function generateRulesContent(_lockfile: Lockfile): string {
  return `${GREKT_BLOCK_START}
This project uses grekt for AI artifact management.
Index location: .grekt/index
${GREKT_BLOCK_END}`;
}

export const claudePlugin = createFolderPlugin({
  id: "claude",
  name: "Claude",
  targetDir: TARGET_DIR,
  rulesFile: RULES_FILE,
  generateRulesContent,
});

export default claudePlugin;
