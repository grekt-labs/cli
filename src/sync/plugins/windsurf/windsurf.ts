import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const windsurfPlugin = createFolderPlugin({
  id: "windsurf",
  name: "Windsurf",
  targetDir: ".windsurf",
  entryPoints: [".windsurfrules"],
  generateRulesContent: generateDefaultBlockContent,
});

export default windsurfPlugin;
