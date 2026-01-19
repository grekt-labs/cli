import { existsSync, readFileSync, writeFileSync } from "fs";
import { parse, stringify } from "yaml";
import { InstalledYamlSchema, type InstalledYaml } from "../schemas/index.js";
import { INSTALLED_FILE, AGENTS_DIR, SKILLS_DIR, COMMANDS_DIR } from "./paths.js";

export function getInstalledPath(projectRoot: string = process.cwd()): string {
  return `${projectRoot}/${INSTALLED_FILE}`;
}

export function getInstalled(projectRoot: string = process.cwd()): InstalledYaml {
  const filepath = getInstalledPath(projectRoot);
  if (!existsSync(filepath)) {
    return createEmptyInstalled();
  }
  const content = readFileSync(filepath, "utf-8");
  const raw = parse(content);
  return InstalledYamlSchema.parse(raw);
}

export function saveInstalled(data: InstalledYaml, projectRoot: string = process.cwd()): void {
  const filepath = getInstalledPath(projectRoot);
  const content = stringify(data);
  writeFileSync(filepath, content, "utf-8");
}

export function createEmptyInstalled(): InstalledYaml {
  return {
    version: 1,
    paths: {
      agents: AGENTS_DIR,
      skills: SKILLS_DIR,
      commands: COMMANDS_DIR,
    },
    agents: {},
    skills: {},
    commands: {},
  };
}

export function installedExists(projectRoot: string = process.cwd()): boolean {
  return existsSync(getInstalledPath(projectRoot));
}
