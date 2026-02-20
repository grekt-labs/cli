/**
 * Centralized skip reason protocol for sync results.
 *
 * SyncResult.skipped is string[] (defined in cli-engine), so we encode
 * structured skip information as "path (reason)" strings. This module
 * is the single source of truth for that encoding.
 */

export type SkipReason =
  | "lazy"
  | "invalid-artifact"
  | "unsafe-path"
  | "source-not-found"
  | "file-not-found";

const REASON_LABELS: Record<SkipReason, string> = {
  "lazy": "lazy mode",
  "invalid-artifact": "invalid artifact",
  "unsafe-path": "unsafe path",
  "source-not-found": "source not found",
  "file-not-found": "file doesn't exist",
};

const LABEL_TO_REASON: Record<string, SkipReason> = Object.fromEntries(
  Object.entries(REASON_LABELS).map(([reason, label]) => [label, reason as SkipReason])
);

export interface SkippedEntry {
  path: string;
  reason: SkipReason;
}

/**
 * Encode a skip entry as a string for SyncResult.skipped.
 */
export function formatSkipped(path: string, reason: SkipReason): string {
  return `${path} (${REASON_LABELS[reason]})`;
}

/**
 * Decode a SyncResult.skipped string back into structured data.
 * Returns null if the string doesn't match the expected format.
 */
export function parseSkipped(entry: string): SkippedEntry | null {
  const match = entry.match(/^(.+) \(([^)]+)\)$/);
  if (!match) return null;

  const [, path, label] = match;
  const reason = LABEL_TO_REASON[label];

  if (!reason) return null;

  return { path, reason };
}

/**
 * Check if a skipped entry has a specific reason without full parsing.
 */
export function isSkipReason(entry: string, reason: SkipReason): boolean {
  return entry.endsWith(`(${REASON_LABELS[reason]})`);
}

/**
 * Extract the path from a skipped entry with a known reason.
 */
export function extractSkippedPath(entry: string, reason: SkipReason): string {
  const suffix = ` (${REASON_LABELS[reason]})`;
  return entry.endsWith(suffix) ? entry.slice(0, -suffix.length) : entry;
}
