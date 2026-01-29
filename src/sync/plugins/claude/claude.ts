import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";

const TARGET_DIR = ".claude";
const CONTEXT_ENTRY_POINT = `${TARGET_DIR}/CLAUDE.md`;

export const claudePlugin = createFolderPlugin({
  id: "claude",
  name: "Claude",
  targetDir: TARGET_DIR,
  contextEntryPoint: CONTEXT_ENTRY_POINT,
  generateRulesContent: generateDefaultBlockContent,
});

export default claudePlugin;
