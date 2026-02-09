import { createRulesOnlyPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const copilotPlugin = createRulesOnlyPlugin({
  id: "copilot",
  name: "Copilot",
  entryPoints: [".github/copilot-instructions.md"],
  generateRulesContent: generateDefaultBlockContent,
});

export default copilotPlugin;
