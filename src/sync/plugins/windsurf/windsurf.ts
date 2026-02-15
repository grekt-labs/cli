import { createFolderPlugin, generateDefaultBlockContent } from "#/sync/base/base";
import { copySiblingFiles } from "#/sync/helpers/siblings";

export const windsurfPlugin = createFolderPlugin({
  id: "windsurf",
  name: "Windsurf",
  targetDir: ".windsurf",
  entryPoints: [".windsurfrules"],
  generateRulesContent: generateDefaultBlockContent,
  afterFileSync: ({ sourcePath, sourceDir, targetDir }) => {
    copySiblingFiles(sourceDir, targetDir, sourcePath);
  },
});

export default windsurfPlugin;
