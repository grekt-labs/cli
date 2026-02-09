import { createRulesOnlyPlugin, generateDefaultBlockContent } from "#/sync/base/base";

export const codexPlugin = createRulesOnlyPlugin({
  id: "codex",
  name: "Codex",
  entryPoints: ["AGENTS.md"],
  generateRulesContent: generateDefaultBlockContent,
});

export default codexPlugin;
