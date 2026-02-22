import { createFolderPlugin } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".opencode";

export const opencodePlugin = createFolderPlugin({
  id: "opencode",
  name: "OpenCode",
  targetDir: TARGET_DIR,
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default opencodePlugin;

// MCP distribution config for OpenCode (opencode.json)
export { opencodeMcpConfig } from "./opencode.mcp";
