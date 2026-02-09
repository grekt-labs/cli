import { createFolderPlugin } from "#/sync/base/base";

export const continuePlugin = createFolderPlugin({
  id: "continue",
  name: "Continue",
  targetDir: ".continue",
});

export default continuePlugin;
