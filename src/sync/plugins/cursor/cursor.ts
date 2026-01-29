import { createRulesOnlyPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const cursorPlugin = createRulesOnlyPlugin({
  id: "cursor",
  name: "Cursor",
  contextEntryPoint: ".cursorrules",
  generateRulesContent: generateDefaultBlockContent,
});

export default cursorPlugin;
