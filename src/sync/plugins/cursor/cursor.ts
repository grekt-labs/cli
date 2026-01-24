import { createRulesOnlyPlugin, GREKT_BLOCK_START, GREKT_BLOCK_END } from "#/sync/base/base";

function generateRulesContent(): string {
  return `${GREKT_BLOCK_START}
This project uses grekt. Configuration in \`grekt.yaml\`.

If the user uses a command (e.g., /review), check \`grekt.lock\` to see if it exists and execute the instructions from the corresponding file.
${GREKT_BLOCK_END}`;
}

export const cursorPlugin = createRulesOnlyPlugin({
  id: "cursor",
  name: "Cursor",
  rulesFile: ".cursorrules",
  generateRulesContent,
});

export default cursorPlugin;
