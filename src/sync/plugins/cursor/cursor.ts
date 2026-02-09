import { createRulesOnlyPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const cursorPlugin = createRulesOnlyPlugin({
  id: "cursor",
  name: "Cursor",
  entryPoints: [".cursorrules"],
  generateRulesContent: generateDefaultBlockContent,
});

export default cursorPlugin;
