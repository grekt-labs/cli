import { isInitialized } from "#/config/project/project";
import { error, info } from "#/shared/ui/ui";

export function requireInitialized(projectRoot?: string): void {
  if (!isInitialized(projectRoot)) {
    error("grekt is not initialized in this directory");
    info("Run 'grekt init' first");
    process.exit(1);
  }
}
