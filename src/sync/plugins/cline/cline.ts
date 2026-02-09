import { createRulesOnlyPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const clinePlugin = createRulesOnlyPlugin({
  id: "cline",
  name: "Cline",
  entryPoints: [".clinerules"],
  generateRulesContent: generateDefaultBlockContent,
});

export default clinePlugin;
