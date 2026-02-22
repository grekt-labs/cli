import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".github";

export const copilotPlugin = createFolderPlugin({
  id: "copilot",
  name: "Copilot",
  targetDir: TARGET_DIR,
  entryPoints: [".github/copilot-instructions.md"],
  generateRulesContent: generateDefaultBlockContent,
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default copilotPlugin;

// MCP distribution config for VS Code / Copilot (.vscode/mcp.json)
export { copilotMcpConfig } from "./copilot.mcp";
