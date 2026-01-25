import { existsSync, readFileSync, writeFileSync } from "fs";
import { parse, stringify } from "yaml";
import { LockfileSchema, type Lockfile } from "@grekt-labs/cli-engine";
import { LOCKFILE } from "#/config/paths/paths";

function getLockfilePath(projectRoot: string = process.cwd()): string {
  return `${projectRoot}/${LOCKFILE}`;
}

export function getLockfile(projectRoot: string = process.cwd()): Lockfile {
  const filepath = getLockfilePath(projectRoot);
  if (!existsSync(filepath)) {
    return createEmptyLockfile();
  }
  const content = readFileSync(filepath, "utf-8");
  const raw = parse(content);
  return LockfileSchema.parse(raw);
}

export function saveLockfile(data: Lockfile, projectRoot: string = process.cwd()): void {
  const filepath = getLockfilePath(projectRoot);
  const content = stringify(data);
  writeFileSync(filepath, content, "utf-8");
}

export function createEmptyLockfile(): Lockfile {
  return {
    version: 1,
    artifacts: {},
  };
}

export function lockfileExists(projectRoot: string = process.cwd()): boolean {
  return existsSync(getLockfilePath(projectRoot));
}
