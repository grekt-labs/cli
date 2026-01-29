import { createRulesOnlyPlugin, GREKT_BLOCK_START, GREKT_BLOCK_END } from "#/sync/base/base";

function generateRulesContent(): string {
  return `${GREKT_BLOCK_START}
This project uses grekt for AI artifact management.
Index location: .grekt/index
${GREKT_BLOCK_END}`;
}

export const cursorPlugin = createRulesOnlyPlugin({
  id: "cursor",
  name: "Cursor",
  rulesFile: ".cursorrules",
  generateRulesContent,
});

export default cursorPlugin;
