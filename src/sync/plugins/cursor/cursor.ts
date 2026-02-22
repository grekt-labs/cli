import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".cursor";

export const cursorPlugin = createFolderPlugin({
  id: "cursor",
  name: "Cursor",
  targetDir: TARGET_DIR,
  entryPoints: [".cursorrules"],
  generateRulesContent: generateDefaultBlockContent,
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default cursorPlugin;

// MCP distribution config for Cursor (.cursor/mcp.json)
export { cursorMcpConfig } from "./cursor.mcp";
