import { createFolderPlugin } from "#/sync/base/base";
import { writeSkillRouter } from "#/sync/helpers/skillRouter";

const TARGET_DIR = ".continue";

export const continuePlugin = createFolderPlugin({
  id: "continue",
  name: "Continue",
  targetDir: TARGET_DIR,
  setup: (projectRoot) => {
    writeSkillRouter(projectRoot, TARGET_DIR);
  },
});

export default continuePlugin;
