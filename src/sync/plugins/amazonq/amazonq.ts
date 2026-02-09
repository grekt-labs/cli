import { createFolderPlugin } from "#/sync/base/base";

export const amazonqPlugin = createFolderPlugin({
  id: "amazonq",
  name: "Amazon Q",
  targetDir: ".amazonq",
});

export default amazonqPlugin;
