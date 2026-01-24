import { createFolderPlugin, GREKT_BLOCK_START, GREKT_BLOCK_END } from "#/sync/base/base";
import type { Lockfile } from "#/schemas/index";

const TARGET_DIR = ".claude";
const RULES_FILE = `${TARGET_DIR}/CLAUDE.md`;

function generateRulesContent(lockfile: Lockfile): string {
  const artifacts = Object.keys(lockfile.artifacts);

  let content = `${GREKT_BLOCK_START}\n`;
  content += `Grekt artifacts installed. See \`grekt.yaml\` for details.\n`;

  if (artifacts.length > 0) {
    content += `\nArtifacts: ${artifacts.join(", ")}\n`;
  }

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
