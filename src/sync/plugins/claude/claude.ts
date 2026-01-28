import { createFolderPlugin, GREKT_BLOCK_START, GREKT_BLOCK_END } from "#/sync/base/base";
import type { Lockfile } from "@grekt-labs/cli-engine";

const TARGET_DIR = ".claude";
const RULES_FILE = `${TARGET_DIR}/CLAUDE.md`;

/**
 * Generate minimal bootstrap content for CLAUDE.md.
 * Points Claude to the artifact index for lazy loading.
 */
function generateRulesContent(_lockfile: Lockfile): string {
  let content = `${GREKT_BLOCK_START}\n`;
  content += `Tools available in \`.grekt/index\`\n`;
  content += `${GREKT_BLOCK_END}`;
  return content;
}

export const claudePlugin = createFolderPlugin({
  id: "claude",
  name: "Claude",
  targetDir: TARGET_DIR,
  rulesFile: RULES_FILE,
  generateRulesContent,
});

export default claudePlugin;
