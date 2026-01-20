import { createFolderPlugin } from "./base";

export const opencodePlugin = createFolderPlugin({
  id: "opencode",
  name: "OpenCode",
  targetDir: ".opencode",
  // No rules file for OpenCode
});

export default opencodePlugin;
