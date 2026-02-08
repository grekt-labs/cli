import { fs } from "#/context";
import { GREKT_DIR } from "#/config/paths/paths";
import { success, warning } from "#/shared/ui/ui";

export function ensureGitignore(projectRoot: string): void {
  const gitignorePath = `${projectRoot}/.gitignore`;

  if (!fs.exists(gitignorePath)) {
    warning(`No .gitignore found. We encourage you to add ${GREKT_DIR} to your .gitignore`);
    return;
  }

  const content = fs.readFile(gitignorePath);
  const lines = content.split("\n");
  const alreadyIgnored = lines.some((line) => line.trim() === GREKT_DIR);

  if (alreadyIgnored) {
    return;
  }

  const separator = content.endsWith("\n") ? "" : "\n";
  fs.writeFile(gitignorePath, `${content}${separator}${GREKT_DIR}\n`);
  success(`Added ${GREKT_DIR} to .gitignore`);
}
