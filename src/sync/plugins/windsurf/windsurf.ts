import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".windsurf";

export const windsurfPlugin = createFolderPlugin({
  id: "windsurf",
  name: "Windsurf",
  targetDir: TARGET_DIR,
  entryPoints: [".windsurfrules"],
  generateRulesContent: generateDefaultBlockContent,
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default windsurfPlugin;
