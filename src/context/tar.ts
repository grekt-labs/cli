import * as tar from "tar";
import type { TarOperations, TarCreateOptions, TarExtractOptions, TarEntry } from "@grekt/engine";

/**
 * Real TarOperations implementation using the `tar` npm package.
 * Replaces system `tar` binary dependency for cross-platform compatibility.
 */
export function createTarOperations(): TarOperations {
  return {
    create(options: TarCreateOptions): void {
      tar.create(
        {
          sync: true,
          file: options.outputPath,
          gzip: options.gzip,
          cwd: options.sourceDir,
          filter: options.exclude?.length
            ? (path: string) => !options.exclude!.some((pattern) => path.includes(pattern))
            : undefined,
        },
        options.entries
      );
    },

    extract(options: TarExtractOptions): void {
      tar.extract({
        sync: true,
        file: options.tarballPath,
        cwd: options.targetDir,
        strip: options.stripComponents,
      });
    },

    list(tarballPath: string): TarEntry[] {
      const entries: TarEntry[] = [];

      tar.list({
        sync: true,
        file: tarballPath,
        onReadEntry: (entry) => {
          entries.push({
            path: entry.path,
            type: mapEntryType(entry.type),
            linkTarget: entry.type === "SymbolicLink" ? entry.linkpath : undefined,
          });
        },
      });

      return entries;
    },
  };
}

function mapEntryType(type: string): TarEntry["type"] {
  switch (type) {
    case "File":
      return "file";
    case "Directory":
      return "directory";
    case "SymbolicLink":
      return "symlink";
    default:
      return "other";
  }
}

/**
 * Singleton instance for convenience.
 */
export const tarOps = createTarOperations();
