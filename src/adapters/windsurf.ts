import { existsSync, readFileSync, writeFileSync } from "fs";
import type { SyncAdapter, SyncResult, SyncOptions, SyncPreview } from "./interface.js";
import type { InstalledYaml } from "../schemas/index.js";
import { WINDSURF_RULES_FILE, INSTALLED_FILE } from "../lib/paths.js";

const GREKT_BLOCK_START = "<!-- GREKT -->";
const GREKT_BLOCK_END = "<!-- /GREKT -->";

export const windsurfAdapter: SyncAdapter = {
  name: "Windsurf",
  targetFile: WINDSURF_RULES_FILE,

  targetExists(projectRoot: string): boolean {
    return existsSync(`${projectRoot}/${WINDSURF_RULES_FILE}`);
  },

  async sync(installed: InstalledYaml, projectRoot: string, options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { created: [], updated: [], skipped: [] };

    if (options.dryRun) {
      const preview = this.preview(installed, projectRoot);
      return {
        created: preview.willCreate,
        updated: preview.willUpdate,
        skipped: preview.willSkip,
      };
    }

    const filepath = `${projectRoot}/${WINDSURF_RULES_FILE}`;
    const grektBlock = generateGrektBlock();

    if (!existsSync(filepath)) {
      if (!options.createTarget) {
        result.skipped.push(`${WINDSURF_RULES_FILE} (file doesn't exist)`);
        return result;
      }
      // Create new file
      writeFileSync(filepath, grektBlock, "utf-8");
      result.created.push(WINDSURF_RULES_FILE);
      return result;
    }

    // Update existing file
    let content = readFileSync(filepath, "utf-8");
    const startIndex = content.indexOf(GREKT_BLOCK_START);
    const endIndex = content.indexOf(GREKT_BLOCK_END);

    if (startIndex !== -1 && endIndex !== -1) {
      // Replace existing block
      content = content.slice(0, startIndex) + grektBlock + content.slice(endIndex + GREKT_BLOCK_END.length);
      result.updated.push(WINDSURF_RULES_FILE);
    } else {
      // Append block
      content = content.trimEnd() + "\n\n" + grektBlock;
      result.updated.push(WINDSURF_RULES_FILE);
    }

    writeFileSync(filepath, content, "utf-8");
    return result;
  },

  preview(installed: InstalledYaml, projectRoot: string): SyncPreview {
    const filepath = `${projectRoot}/${WINDSURF_RULES_FILE}`;

    if (!existsSync(filepath)) {
      return {
        willCreate: [WINDSURF_RULES_FILE],
        willUpdate: [],
        willSkip: [],
      };
    }

    return {
      willCreate: [],
      willUpdate: [WINDSURF_RULES_FILE],
      willSkip: [],
    };
  },
};

function generateGrektBlock(): string {
  return `${GREKT_BLOCK_START}
This project uses grekt. Configuration in \`${INSTALLED_FILE}\`.

If the user uses a command (e.g., /review), check \`${INSTALLED_FILE}\` to see if it exists and execute the instructions from the corresponding file.
${GREKT_BLOCK_END}`;
}
