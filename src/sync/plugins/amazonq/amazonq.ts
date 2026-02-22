import { createFolderPlugin } from "#/sync/base/base";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".amazonq";

export const amazonqPlugin = createFolderPlugin({
  id: "amazonq",
  name: "Amazon Q",
  targetDir: TARGET_DIR,
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default amazonqPlugin;

// MCP distribution config for Amazon Q (.amazonq/mcp.json)
export { amazonqMcpConfig } from "./amazonq.mcp";
