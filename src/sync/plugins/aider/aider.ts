import { createRulesOnlyPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const aiderPlugin = createRulesOnlyPlugin({
  id: "aider",
  name: "Aider",
  entryPoints: ["CONVENTIONS.md"],
  generateRulesContent: generateDefaultBlockContent,
});

export default aiderPlugin;
