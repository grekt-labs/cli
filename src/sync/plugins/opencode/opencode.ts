import { createFolderPlugin } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";

export const opencodePlugin = createFolderPlugin({
  id: "opencode",
  name: "OpenCode",
  targetDir: ".opencode",
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
});

export default opencodePlugin;
