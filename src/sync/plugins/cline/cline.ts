import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".clinerules";

export const clinePlugin = createFolderPlugin({
  id: "cline",
  name: "Cline",
  targetDir: TARGET_DIR,
  generateRulesContent: generateDefaultBlockContent,
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default clinePlugin;
