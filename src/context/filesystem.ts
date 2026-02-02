import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
  copyFileSync,
  renameSync,
  chmodSync,
  cpSync,
} from "fs";
import type { FileSystem } from "@grekt-labs/cli-engine";

/**
 * Copy options for recursive directory copying.
 */
export interface CopyOptions {
  recursive?: boolean;
  filter?: (src: string) => boolean;
}

/**
 * Extended FileSystem interface with additional CLI-specific methods.
 * Extends cli-engine's FileSystem with chmod and copy operations.
 */
export interface ExtendedFileSystem extends FileSystem {
  chmod(path: string, mode: number): void;
  copy(src: string, dest: string, options?: CopyOptions): void;
}

/**
 * Real FileSystem implementation using Node.js fs module.
 * This is passed to cli-engine functions for actual file operations.
 */
export function createFileSystem(): ExtendedFileSystem {
  return {
    readFile: (path: string) => readFileSync(path, "utf-8"),
    readFileBinary: (path: string) => readFileSync(path),
    writeFile: (path: string, content: string) => writeFileSync(path, content, "utf-8"),
    writeFileBinary: (path: string, content: Buffer) => writeFileSync(path, content),
    exists: (path: string) => existsSync(path),
    mkdir: (path: string, options?: { recursive?: boolean }) => {
      mkdirSync(path, options);
    },
    readdir: (path: string) => readdirSync(path),
    stat: (path: string) => {
      const stat = statSync(path);
      return {
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
      };
    },
    unlink: (path: string) => unlinkSync(path),
    rmdir: (path: string, options?: { recursive?: boolean }) => {
      rmSync(path, { ...options, force: true });
    },
    copyFile: (src: string, dest: string) => copyFileSync(src, dest),
    rename: (src: string, dest: string) => renameSync(src, dest),
    chmod: (path: string, mode: number) => chmodSync(path, mode),
    copy: (src: string, dest: string, options?: CopyOptions) => {
      cpSync(src, dest, options);
    },
  };
}

/**
 * Singleton instance for convenience.
 * Most CLI code can use this directly.
 */
export const fs = createFileSystem();
